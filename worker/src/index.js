/* ============================================================================
   Football Manager — Cloudflare Worker API
   - Autenticación email + password (PBKDF2-SHA256, sesiones en D1)
   - Persistencia de datos por usuario (tabla user_data)
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
            u.id AS id, u.email AS email,
            u.data_owner_id AS data_owner_id, u.share_code AS share_code
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
  const ownerId = row.data_owner_id || row.id;
  return {
    id: row.id,
    email: row.email,
    token,
    dataOwnerId: ownerId,
    shareCode: row.share_code,
  };
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
  const shareCode = randomHex(4);
  const passwordHash = await hashPassword(password, salt);
  const now = Math.floor(Date.now() / 1000);

  try {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, salt, created_at, data_owner_id, share_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, email, passwordHash, salt, now, id, shareCode)
      .run();
  } catch {
    return json({ error: "Ese email ya está registrado" }, 409);
  }

  const token = await createSession(env, id);
  return json(
    { user: { id, email } },
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
    "SELECT id, email, password_hash, salt FROM users WHERE email = ?"
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
    { user: { id: user.id, email: user.email } },
    200,
    { "set-cookie": sessionCookie(token, SESSION_TTL_SECONDS) }
  );
}

async function handleLogout(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  return json(
    { ok: true },
    200,
    { "set-cookie": sessionCookie("", 0) }
  );
}

async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "No autenticado" }, 401);
  return json({ user: { id: user.id, email: user.email } });
}

async function handleGetDataAll(env, user) {
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM user_data WHERE user_id = ?"
  )
    .bind(user.dataOwnerId)
    .all();
  const data = {};
  for (const row of results) data[row.key] = row.value;
  return json({ data });
}

async function handleGetData(env, user, key) {
  const row = await env.DB.prepare(
    "SELECT value FROM user_data WHERE user_id = ? AND key = ?"
  )
    .bind(user.dataOwnerId, key)
    .first();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json({ key, value: row.value });
}

async function handlePutData(request, env, user, key) {
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
    .bind(user.dataOwnerId, key, body.value, now)
    .run();
  return json({ key, ok: true });
}

async function handleDeleteData(env, user, key) {
  await env.DB.prepare("DELETE FROM user_data WHERE user_id = ? AND key = ?")
    .bind(user.dataOwnerId, key)
    .run();
  return json({ key, ok: true });
}

/* ---------------------------- equipo compartido --------------------------- */

async function handleGetShare(env, user) {
  const ownerId = user.dataOwnerId;
  const owner = await env.DB.prepare(
    "SELECT id, email, share_code FROM users WHERE id = ?"
  )
    .bind(ownerId)
    .first();
  const { results } = await env.DB.prepare(
    "SELECT email FROM users WHERE data_owner_id = ? ORDER BY created_at"
  )
    .bind(ownerId)
    .all();
  return json({
    code: owner?.share_code || null,
    ownerEmail: owner?.email || null,
    isOwner: ownerId === user.id,
    members: results.map((r) => r.email),
  });
}

async function handleJoinShare(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const code = String(body?.code || "").trim().toLowerCase();
  if (!code) return json({ error: "Introduce un código" }, 400);

  const owner = await env.DB.prepare(
    "SELECT id, data_owner_id, share_code FROM users WHERE share_code = ?"
  )
    .bind(code)
    .first();
  if (!owner) return json({ error: "Código no válido" }, 404);

  const ownerId = owner.data_owner_id || owner.id;
  if (ownerId === user.id) return json({ error: "Ese código es el tuyo" }, 400);

  await env.DB.prepare("UPDATE users SET data_owner_id = ? WHERE id = ?")
    .bind(ownerId, user.id)
    .run();
  return json({ ok: true, code: owner.share_code });
}

async function handleLeaveShare(env, user) {
  await env.DB.prepare("UPDATE users SET data_owner_id = id WHERE id = ?")
    .bind(user.id)
    .run();
  return json({ ok: true });
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

  if (path === "/share" && method === "GET") return handleGetShare(env, user);
  if (path === "/share/join" && method === "POST") return handleJoinShare(request, env, user);
  if (path === "/share/leave" && method === "POST") return handleLeaveShare(env, user);

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

  return json({ error: "Ruta no encontrada" }, 404);
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
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
