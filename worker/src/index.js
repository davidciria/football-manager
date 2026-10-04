/* ============================================================================
   Football Manager — Cloudflare Worker API
   - Autenticación email + password (PBKDF2-SHA256, sesiones en D1)
   - Equipos (workspaces) con roles owner/editor/viewer
   - Persistencia de datos por equipo (tabla user_data, user_id = team_id)
   - Sirve también los assets estáticos del frontend (binding ASSETS)
============================================================================ */

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días
const PBKDF2_ITERATIONS = 100000;
const COOKIE_NAME = "fm_session";

const DATA_KEYS = new Set([
  "squad",
  "templates",
  "active-match",
  "history",
  "settings",
  "boards",
]);

const ROLES = new Set(["owner", "editor", "viewer"]);
const WRITE_ROLES = new Set(["owner", "editor"]);

/* ----------------------------- utilidades --------------------------------- */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function randomHex(nBytes) {
  const bytes = new Uint8Array(nBytes);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function sessionCookie(token, maxAge) {
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ------------------------------ sesiones ---------------------------------- */

async function createSession(env, userId) {
  const token = randomHex(32);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, userId, now, now + SESSION_TTL_SECONDS)
    .run();
  return token;
}

async function getSessionUser(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT s.token AS token, s.expires_at AS expires_at,
            u.id AS id, u.email AS email, u.active_team_id AS active_team_id
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  return { id: row.id, email: row.email, token, activeTeamId: row.active_team_id };
}

/* ------------------------------- equipos ---------------------------------- */

async function membershipFor(env, userId, teamId) {
  return env.DB.prepare(
    "SELECT team_id, user_id, role FROM team_members WHERE team_id = ? AND user_id = ?"
  )
    .bind(teamId, userId)
    .first();
}

async function listTeams(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.name, t.owner_id, t.created_at, m.role,
            (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS members
     FROM team_members m JOIN teams t ON t.id = m.team_id
     WHERE m.user_id = ?
     ORDER BY t.created_at`
  )
    .bind(userId)
    .all();

  const teams = [];
  for (const r of results) {
    const { results: mem } = await env.DB.prepare(
      `SELECT u.email AS email, tm.role AS role, tm.user_id AS user_id
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ? ORDER BY tm.created_at`
    )
      .bind(r.id)
      .all();
    teams.push({
      id: r.id,
      name: r.name,
      role: r.role,
      isOwner: r.owner_id === userId,
      members: r.members,
      membersList: mem.map((x) => ({
        email: x.email,
        role: x.role,
        isOwner: x.user_id === r.owner_id,
      })),
    });
  }
  return teams;
}

async function memberEmails(env, teamId) {
  const { results } = await env.DB.prepare(
    `SELECT u.email AS email, m.role AS role, m.user_id AS user_id
     FROM team_members m JOIN users u ON u.id = m.user_id
     WHERE m.team_id = ? ORDER BY m.created_at`
  )
    .bind(teamId)
    .all();
  return results;
}

/* ------------------------------- handlers --------------------------------- */

async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!isValidEmail(email)) return json({ error: "Email no válido" }, 400);
  if (password.length < 8)
    return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) return json({ error: "Ese email ya está registrado" }, 409);

  const id = crypto.randomUUID();
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const now = Math.floor(Date.now() / 1000);
  const teamId = "team_" + crypto.randomUUID();
  const shareCode = randomHex(4);

  try {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, salt, created_at, data_owner_id, share_code, active_team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, email, passwordHash, salt, now, id, shareCode, teamId)
      .run();

    // Equipo personal del nuevo usuario.
    await env.DB.prepare(
      "INSERT INTO teams (id, name, owner_id, share_code, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(teamId, "Mi equipo", id, shareCode, now)
      .run();
    await env.DB.prepare(
      "INSERT INTO team_members (team_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)"
    )
      .bind(teamId, id, now)
      .run();
  } catch {
    return json({ error: "Ese email ya está registrado" }, 409);
  }

  const token = await createSession(env, id);
  return json(
    { user: { id, email }, activeTeamId: teamId },
    201,
    { "set-cookie": sessionCookie(token, SESSION_TTL_SECONDS) }
  );
}

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email || !password) return json({ error: "Faltan credenciales" }, 400);

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, salt, active_team_id FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!user) return json({ error: "Email o contraseña incorrectos" }, 401);

  const hash = await hashPassword(password, user.salt);
  if (!timingSafeEqual(hash, user.password_hash)) {
    return json({ error: "Email o contraseña incorrectos" }, 401);
  }

  const token = await createSession(env, user.id);
  return json(
    { user: { id: user.id, email: user.email }, activeTeamId: user.active_team_id },
    200,
    { "set-cookie": sessionCookie(token, SESSION_TTL_SECONDS) }
  );
}

async function handleLogout(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "No autenticado" }, 401);
  return json({
    user: { id: user.id, email: user.email },
    activeTeamId: user.activeTeamId,
  });
}

/* -------------------------------- /teams ---------------------------------- */

async function handleListTeams(env, user) {
  const teams = await listTeams(env, user.id);
  return json({ teams, activeTeamId: user.activeTeamId });
}

async function handleCreateTeam(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const name = String(body?.name || "").trim() || "Equipo sin nombre";
  const id = "team_" + crypto.randomUUID();
  const shareCode = randomHex(4);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO teams (id, name, owner_id, share_code, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, name, user.id, shareCode, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO team_members (team_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)"
  )
    .bind(id, user.id, now)
    .run();
  return json({ team: { id, name, role: "owner", isOwner: true, members: 1 } }, 201);
}

async function handleGetTeam(env, user, teamId) {
  const member = await membershipFor(env, user.id, teamId);
  if (!member) return json({ error: "No perteneces a ese equipo" }, 403);
  const team = await env.DB.prepare(
    "SELECT id, name, owner_id, share_code, created_at FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first();
  if (!team) return json({ error: "Equipo no encontrado" }, 404);
  const members = await memberEmails(env, teamId);
  return json({
    team: {
      id: team.id,
      name: team.name,
      role: member.role,
      isOwner: team.owner_id === user.id,
      shareCode: team.share_code,
      members: members.map((m) => ({ email: m.email, role: m.role, isOwner: m.user_id === team.owner_id })),
    },
  });
}

async function handleUpdateTeam(request, env, user, teamId) {
  const m = await membershipFor(env, user.id, teamId);
  if (!m || m.role !== "owner") return json({ error: "Solo el propietario" }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const name = String(body?.name || "").trim();
  if (!name) return json({ error: "Nombre requerido" }, 400);
  await env.DB.prepare("UPDATE teams SET name = ? WHERE id = ?").bind(name, teamId).run();
  return json({ ok: true, name });
}

async function handleDeleteTeam(env, user, teamId) {
  const m = await membershipFor(env, user.id, teamId);
  if (!m || m.role !== "owner") return json({ error: "Solo el propietario" }, 403);
  // No permitir borrar el último equipo del usuario.
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM team_members WHERE user_id = ?"
  )
    .bind(user.id)
    .first();
  if (count.n <= 1) return json({ error: "No puedes borrar tu único equipo" }, 400);
  await env.DB.prepare("DELETE FROM user_data WHERE user_id = ?").bind(teamId).run();
  await env.DB.prepare("DELETE FROM team_members WHERE team_id = ?").bind(teamId).run();
  await env.DB.prepare("DELETE FROM teams WHERE id = ?").bind(teamId).run();
  return json({ ok: true });
}

async function handleSetActiveTeam(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const teamId = String(body?.teamId || "");
  const m = await membershipFor(env, user.id, teamId);
  if (!m) return json({ error: "No perteneces a ese equipo" }, 403);
  await env.DB.prepare("UPDATE users SET active_team_id = ? WHERE id = ?")
    .bind(teamId, user.id)
    .run();
  return json({ ok: true, activeTeamId: teamId });
}

/* ----------------------------- /teams/join -------------------------------- */

async function handleJoinTeam(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const code = String(body?.code || "").trim().toLowerCase();
  if (!code) return json({ error: "Introduce un código" }, 400);

  const team = await env.DB.prepare(
    "SELECT id, name, owner_id FROM teams WHERE lower(share_code) = ?"
  )
    .bind(code)
    .first();
  if (!team) return json({ error: "Código no válido" }, 404);

  const already = await membershipFor(env, user.id, team.id);
  if (!already) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO team_members (team_id, user_id, role, created_at) VALUES (?, ?, 'viewer', ?)"
    )
      .bind(team.id, user.id, now)
      .run();
  }
  await env.DB.prepare("UPDATE users SET active_team_id = ? WHERE id = ?")
    .bind(team.id, user.id)
    .run();
  return json({ ok: true, team: { id: team.id, name: team.name, role: already?.role || "viewer" } });
}

async function handleTeamMembers(env, user, teamId) {
  const m = await membershipFor(env, user.id, teamId);
  if (!m) return json({ error: "No perteneces a ese equipo" }, 403);
  const team = await env.DB.prepare("SELECT owner_id FROM teams WHERE id = ?")
    .bind(teamId)
    .first();
  const members = await memberEmails(env, teamId);
  return json({
    members: members.map((x) => ({
      email: x.email,
      role: x.role,
      isOwner: x.user_id === team.owner_id,
      isMe: x.user_id === user.id,
    })),
  });
}

async function handleUpdateMember(request, env, user, teamId, memberEmail) {
  const m = await membershipFor(env, user.id, teamId);
  if (!m || m.role !== "owner") return json({ error: "Solo el propietario" }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const role = String(body?.role || "");
  if (!ROLES.has(role) || role === "owner") return json({ error: "Rol no válido" }, 400);

  const target = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(memberEmail)
    .first();
  if (!target) return json({ error: "Miembro no encontrado" }, 404);
  const team = await env.DB.prepare("SELECT owner_id FROM teams WHERE id = ?").bind(teamId).first();
  if (team.owner_id === target.id) return json({ error: "No puedes cambiar al propietario" }, 400);

  await env.DB.prepare("UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?")
    .bind(role, teamId, target.id)
    .run();
  return json({ ok: true, role });
}

async function handleRemoveMember(env, user, teamId, memberEmail) {
  const m = await membershipFor(env, user.id, teamId);
  if (!m || m.role !== "owner") return json({ error: "Solo el propietario" }, 403);
  const target = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(memberEmail)
    .first();
  if (!target) return json({ error: "Miembro no encontrado" }, 404);
  const team = await env.DB.prepare("SELECT owner_id FROM teams WHERE id = ?").bind(teamId).first();
  if (team.owner_id === target.id) return json({ error: "No puedes expulsar al propietario" }, 400);
  await env.DB.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
    .bind(teamId, target.id)
    .run();
  // Si el expulsado tenía este equipo como activo, devolverlo a su equipo personal.
  await env.DB.prepare(
    "UPDATE users SET active_team_id = (SELECT team_id FROM team_members WHERE user_id = ? ORDER BY created_at LIMIT 1) WHERE id = ? AND active_team_id = ?"
  )
    .bind(target.id, target.id, teamId)
    .run();
  return json({ ok: true });
}

async function handleRegenerateCode(env, user, teamId) {
  const m = await membershipFor(env, user.id, teamId);
  if (!m || m.role !== "owner") return json({ error: "Solo el propietario" }, 403);
  const code = randomHex(4);
  await env.DB.prepare("UPDATE teams SET share_code = ? WHERE id = ?").bind(code, teamId).run();
  return json({ ok: true, shareCode: code });
}

/* --------------------------- datos por equipo ----------------------------- */

async function handleGetData(env, user, key) {
  const m = await membershipFor(env, user.id, user.activeTeamId);
  if (!m) return json({ error: "Sin equipo activo" }, 403);
  const row = await env.DB.prepare(
    "SELECT value FROM user_data WHERE user_id = ? AND key = ?"
  )
    .bind(user.activeTeamId, key)
    .first();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json({ key, value: row.value });
}

async function handlePutData(request, env, user, key) {
  const m = await membershipFor(env, user.id, user.activeTeamId);
  if (!m) return json({ error: "Sin equipo activo" }, 403);
  if (!WRITE_ROLES.has(m.role)) return json({ error: "Solo lectura" }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (typeof body?.value !== "string")
    return json({ error: "Se espera { value: string }" }, 400);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO user_data (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(user.activeTeamId, key, body.value, now)
    .run();
  return json({ key, ok: true });
}

async function handleDeleteData(env, user, key) {
  const m = await membershipFor(env, user.id, user.activeTeamId);
  if (!m) return json({ error: "Sin equipo activo" }, 403);
  if (!WRITE_ROLES.has(m.role)) return json({ error: "Solo lectura" }, 403);
  await env.DB.prepare("DELETE FROM user_data WHERE user_id = ? AND key = ?")
    .bind(user.activeTeamId, key)
    .run();
  return json({ key, ok: true });
}

/* -------------------------------- router ---------------------------------- */

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method.toUpperCase();

  if (path === "/health") return json({ ok: true });

  if (path === "/auth/register" && method === "POST") return handleRegister(request, env);
  if (path === "/auth/login" && method === "POST") return handleLogin(request, env);
  if (path === "/auth/logout" && method === "POST") return handleLogout(request, env);
  if (path === "/auth/me" && method === "GET") return handleMe(request, env);

  // A partir de aquí se requiere sesión.
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "No autenticado" }, 401);

  // Equipos
  if (path === "/teams" && method === "GET") return handleListTeams(env, user);
  if (path === "/teams" && method === "POST") return handleCreateTeam(request, env, user);
  if (path === "/teams/join" && method === "POST") return handleJoinTeam(request, env, user);
  if (path === "/teams/active" && method === "POST") return handleSetActiveTeam(request, env, user);

  let mm;
  if ((mm = path.match(/^\/teams\/([^/]+)\/members\/([^/]+)$/))) {
    const teamId = decodeURIComponent(mm[1]);
    const memberId = decodeURIComponent(mm[2]);
    if (method === "PUT") return handleUpdateMember(request, env, user, teamId, memberId);
    if (method === "DELETE") return handleRemoveMember(env, user, teamId, memberId);
  }
  if ((mm = path.match(/^\/teams\/([^/]+)\/members$/)) && method === "GET")
    return handleTeamMembers(env, user, decodeURIComponent(mm[1]));
  if ((mm = path.match(/^\/teams\/([^/]+)\/code$/)) && method === "POST")
    return handleRegenerateCode(env, user, decodeURIComponent(mm[1]));
  if ((mm = path.match(/^\/teams\/([^/]+)$/))) {
    const teamId = decodeURIComponent(mm[1]);
    if (method === "GET") return handleGetTeam(env, user, teamId);
    if (method === "PUT") return handleUpdateTeam(request, env, user, teamId);
    if (method === "DELETE") return handleDeleteTeam(env, user, teamId);
  }

  // Datos (del equipo activo)
  if (path === "/data" && method === "GET") return handleGetDataAll(env, user);

  const dataMatch = path.match(/^\/data\/(.+)$/);
  if (dataMatch) {
    const key = decodeURIComponent(dataMatch[1]);
    if (!DATA_KEYS.has(key)) return json({ error: "Clave no permitida" }, 400);
    if (method === "GET") return handleGetData(env, user, key);
    if (method === "PUT") return handlePutData(request, env, user, key);
    if (method === "DELETE") return handleDeleteData(env, user, key);
    return json({ error: "Método no permitido" }, 405);
  }

  // Compatibilidad: /share (antiguo) -> datos del equipo activo.
  if (path === "/share" && method === "GET") {
    const m = await membershipFor(env, user.id, user.activeTeamId);
    if (!m) return json({ error: "Sin equipo activo" }, 403);
    return json({ activeTeamId: user.activeTeamId, role: m.role });
  }

  return json({ error: "Ruta no encontrada" }, 404);
}

async function handleGetDataAll(env, user) {
  const m = await membershipFor(env, user.id, user.activeTeamId);
  if (!m) return json({ error: "Sin equipo activo" }, 403);
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM user_data WHERE user_id = ?"
  )
    .bind(user.activeTeamId)
    .all();
  const data = {};
  for (const row of results) data[row.key] = row.value;
  return json({ data, role: m.role });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: "Error interno", detail: String(err?.message || err) }, 500);
      }
    }
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      const ct = res.headers.get("content-type") || "";
      // El HTML (y las rutas SPA) nunca deben cachearse, para que un deploy
      // nuevo se vea al instante. Los assets con hash sí pueden cachearse.
      if (ct.includes("text/html")) {
        const headers = new Headers(res.headers);
        headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
        headers.set("Pragma", "no-cache");
        headers.set("Expires", "0");
        return new Response(res.body, { status: res.status, headers });
      }
      return res;
    }
    return new Response("Not found", { status: 404 });
  },
};
