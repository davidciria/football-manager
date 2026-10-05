import React, { useEffect, useState } from "react";

/* ============================================================================
   Pantalla "Mis equipos": lista de equipos (rol por equipo), crear equipo,
   unirse con código y gestionar/compartir (owner).
============================================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
.fm-teams{
  --deep:#0B1A14; --mid:#12291F; --mid2:#1B3D2F; --line:#F2FAF5;
  --soft:#9DBFAF; --faint:#6F8F7E; --amber:#F5B23F; --amber-ink:#3A2405;
  --sky:#5DB6F0; --red:#FF5A4D; --hair:rgba(234,244,238,0.10); --hair2:rgba(234,244,238,0.18);
  min-height:100vh; min-height:100dvh; width:100%; display:flex; flex-direction:column;
  background:radial-gradient(1200px 620px at 50% -12%, #17362A 0%, var(--deep) 58%);
  color:var(--line); font-family:'Manrope',system-ui,sans-serif;
  padding:calc(20px + env(safe-area-inset-top)) 18px calc(20px + env(safe-area-inset-bottom));
  box-sizing:border-box; overflow-y:auto;
}
.fm-teams *{box-sizing:border-box;}
.fm-teams-inner{width:100%; max-width:520px; margin:0 auto;}
.fm-teams-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;}
.fm-teams-title{font-family:'Teko',sans-serif; font-weight:600; font-size:34px; line-height:0.95; letter-spacing:0.01em;}
.fm-teams-sub{font-size:12.5px; color:var(--soft); font-weight:600;}
.fm-team-card{
  display:flex; align-items:stretch; gap:0; width:100%;
  background:var(--mid); border:1px solid var(--hair2);
  border-radius:18px; margin-bottom:10px; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.25);
}
.fm-team-main{
  display:flex; align-items:center; gap:14px; flex:1; text-align:left; min-width:0;
  background:none; border:none; color:var(--line); cursor:pointer; padding:16px;
  font-family:inherit; transition:background .12s ease;
}
.fm-team-main:active{background:rgba(234,244,238,0.05);}
.fm-team-share{
  flex-shrink:0; width:56px; display:flex; align-items:center; justify-content:center;
  background:rgba(234,244,238,0.04); border:none; border-left:1px solid var(--hair2);
  color:var(--amber); cursor:pointer;
}
.fm-team-share:active{background:rgba(245,178,63,0.15);}
.fm-team-badge{
  width:46px; height:46px; border-radius:13px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--amber); color:var(--amber-ink); font-family:'Teko',sans-serif; font-weight:700; font-size:24px;
}
.fm-team-name{font-weight:800; font-size:16.5px; line-height:1.1;}
.fm-team-meta{font-size:12px; color:var(--soft); margin-top:3px;}
.fm-team-members{display:flex; flex-wrap:wrap; gap:6px; margin-top:9px;}
.fm-member-chip{
  display:inline-flex; align-items:center; gap:6px; max-width:100%;
  background:rgba(234,244,238,0.06); border:1px solid var(--hair);
  border-radius:100px; padding:4px 9px; font-size:11px; color:#DCEFE4;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.fm-member-role{font-size:9.5px; font-weight:800; color:var(--faint); text-transform:uppercase; letter-spacing:0.03em;}
.fm-dot{width:8px; height:8px; border-radius:50%; flex-shrink:0;}
.fm-dot-owner{background:var(--amber);}
.fm-dot-editor{background:var(--sky);}
.fm-dot-viewer{background:var(--faint);}
.fm-avatar{
  width:38px; height:38px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--mid2); border:1px solid var(--hair2); font-weight:800; font-size:15px; color:var(--line);
}
.fm-role{
  display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:800; letter-spacing:0.03em;
  padding:3px 9px; border-radius:100px; text-transform:uppercase;
}
.fm-role-owner{background:rgba(245,178,63,0.18); color:var(--amber);}
.fm-role-editor{background:rgba(93,182,240,0.18); color:var(--sky);}
.fm-role-viewer{background:rgba(234,244,238,0.10); color:var(--soft);}
.fm-teams-actions{display:flex; gap:10px; margin-top:14px;}
.fm-teams-btn{
  flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px;
  border-radius:14px; border:1px solid var(--hair2); background:var(--mid2); color:var(--line);
  font-family:inherit; font-weight:800; font-size:14.5px; cursor:pointer; touch-action:manipulation; min-height:48px;
}
.fm-teams-btn.primary{background:var(--amber); color:var(--amber-ink); border-color:var(--amber);}
.fm-teams-btn:active{transform:scale(0.98);}
.fm-teams-btn:disabled{opacity:0.5;}
.fm-sheet-bg{position:fixed; inset:0; background:rgba(4,10,7,0.72); z-index:50; display:flex; align-items:flex-end; justify-content:center;}
.fm-sheet{
  width:100%; max-width:520px; background:var(--mid); border-radius:22px 22px 0 0;
  padding:6px 0 calc(18px + env(safe-area-inset-bottom)); max-height:88dvh; display:flex; flex-direction:column; overflow:hidden;
  border-top:1px solid var(--hair2);
}
.fm-sheet-handle{width:36px;height:4px;background:var(--hair2);border-radius:100px;margin:10px auto 4px;flex-shrink:0;}
.fm-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:10px 18px 4px;flex-shrink:0;}
.fm-sheet-title{font-family:'Teko',sans-serif;font-weight:600;font-size:23px;color:var(--line);}
.fm-sheet-body{flex:1 1 auto; min-height:0; overflow-y:auto; padding:10px 18px 4px;}
.fm-label2{font-size:11.5px; color:var(--soft); font-weight:800; margin:14px 0 6px; display:block; text-transform:uppercase; letter-spacing:0.05em;}
.fm-input2{
  width:100%; background:#0A1712; border:1px solid var(--hair2); color:#FFF; border-radius:12px;
  padding:13px 14px; font-size:16px; font-family:inherit; font-weight:600; outline:none; min-height:44px;
}
.fm-input2:focus{border-color:var(--amber); box-shadow:0 0 0 3px rgba(245,178,63,0.2);}
.fm-xbtn{background:transparent;border:1px solid var(--hair2);color:var(--line);width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.fm-member-row{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--hair);}
.fm-select{
  background:#0A1712;border:1px solid var(--hair2);color:#FFF;border-radius:10px;padding:7px 9px;
  font-family:inherit;font-weight:700;font-size:12.5px;
}
.fm-code-box{
  flex:1; background:#0A1712; border:1px solid var(--hair2); border-radius:12px; padding:12px;
  font-family:'Teko',sans-serif; font-weight:700; font-size:26px; letter-spacing:0.16em;
  display:flex; align-items:center; justify-content:center; color:#FFF;
}
.fm-err{font-size:12.5px;color:#FF9A90;font-weight:700;margin-top:10px;}
.fm-ok{font-size:12.5px;color:var(--sky);font-weight:700;margin-top:10px;}
.fm-hint{font-size:11.5px;color:var(--faint);line-height:1.5;}
.fm-spinner{width:40px;height:40px;border-radius:50%;border:3px solid rgba(255,255,255,0.18);border-top-color:var(--amber);animation:fms 0.8s linear infinite;margin:60px auto;}
@keyframes fms{to{transform:rotate(360deg);}}
`;

const ROLE_LABEL = { owner: "Propietario", editor: "Editor", viewer: "Solo lectura" };

function GearIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function api(path, options = {}) {
  return fetch("/api" + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

export default function TeamsScreen({ user, onOpenTeam, onLogout }) {
  const [teams, setTeams] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [manageTeam, setManageTeam] = useState(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const res = await api("/teams");
      if (res.ok) {
        const body = await res.json();
        setTeams(body.teams);
      } else {
        setTeams([]);
      }
    } catch {
      setTeams([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await api("/teams", { method: "POST", body: JSON.stringify({ name: name.trim() || "Mi equipo" }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error || "No se pudo crear");
        setBusy(false);
        return;
      }
      setCreateOpen(false);
      setName("");
      await onOpenTeam(body.team.id);
    } catch {
      setErr("Error de conexión");
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await api("/teams/join", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error || "Código no válido");
        setBusy(false);
        return;
      }
      setJoinOpen(false);
      setCode("");
      await onOpenTeam(body.team.id);
    } catch {
      setErr("Error de conexión");
      setBusy(false);
    }
  };

  if (teams === null) {
    return (
      <div className="fm-teams">
        <style>{CSS}</style>
        <div className="fm-spinner" />
      </div>
    );
  }

  return (
    <div className="fm-teams">
      <style>{CSS}</style>
      <div className="fm-teams-inner">
        <div className="fm-teams-head">
          <div>
            <div className="fm-teams-title">MIS EQUIPOS</div>
            <div className="fm-teams-sub">{user.email}</div>
          </div>
          <button className="fm-xbtn" onClick={onLogout} title="Cerrar sesión">⎋</button>
        </div>

        {teams.map((t) => (
          <div key={t.id} className="fm-team-card">
            <button className="fm-team-main" onClick={() => onOpenTeam(t.id)}>
              <div className="fm-team-badge">{t.name.slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="fm-team-name">{t.name}</div>
                  <span className={`fm-role fm-role-${t.role}`}>{ROLE_LABEL[t.role]}</span>
                </div>
                <div className="fm-team-meta">
                  {t.members === 1 ? "Solo tú" : `Compartido con ${t.members - 1}`}
                </div>
              </div>
            </button>
            <button
              className="fm-team-share"
              title="Ajustes del equipo"
              aria-label="Ajustes del equipo"
              onClick={() => setManageTeam(t.id)}
            >
              <GearIcon />
            </button>
          </div>
        ))}

        <div className="fm-teams-actions">
          <button className="fm-teams-btn primary" onClick={() => { setErr(""); setCreateOpen(true); }}>
            + Crear equipo
          </button>
          <button className="fm-teams-btn" onClick={() => { setErr(""); setJoinOpen(true); }}>
            Unirme con código
          </button>
        </div>
      </div>

      {createOpen && (
        <div className="fm-sheet-bg" onClick={() => setCreateOpen(false)}>
          <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fm-sheet-handle" />
            <div className="fm-sheet-head">
              <div className="fm-sheet-title">Nuevo equipo</div>
              <button className="fm-xbtn" onClick={() => setCreateOpen(false)}>✕</button>
            </div>
            <div className="fm-sheet-body">
              <span className="fm-label2">Nombre del equipo</span>
              <input
                className="fm-input2"
                autoFocus
                placeholder="Ej: Cantera 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
              {err && <div className="fm-err">{err}</div>}
              <div className="fm-teams-actions">
                <button className="fm-teams-btn primary" onClick={create} disabled={busy}>
                  {busy ? "Creando…" : "Crear equipo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {joinOpen && (
        <div className="fm-sheet-bg" onClick={() => setJoinOpen(false)}>
          <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fm-sheet-handle" />
            <div className="fm-sheet-head">
              <div className="fm-sheet-title">Unirme a un equipo</div>
              <button className="fm-xbtn" onClick={() => setJoinOpen(false)}>✕</button>
            </div>
            <div className="fm-sheet-body">
              <p className="fm-hint" style={{ marginTop: 0 }}>
                Pega el código que te ha compartido el propietario. Entrarás como <b>solo lectura</b>; él podrá darte permisos de edición.
              </p>
              <span className="fm-label2">Código</span>
              <input
                className="fm-input2"
                autoFocus
                placeholder="Ej: A1B2C3D4"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
                maxLength={12}
              />
              {err && <div className="fm-err">{err}</div>}
              <div className="fm-teams-actions">
                <button className="fm-teams-btn primary" onClick={join} disabled={busy || !code.trim()}>
                  {busy ? "Uniéndome…" : "Unirme"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manageTeam && (
        <ManageTeamSheet
          teamId={manageTeam}
          onClose={() => { setManageTeam(null); load(); }}
        />
      )}
    </div>
  );
}

function ManageTeamSheet({ teamId, onClose }) {
  const [team, setTeam] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    const res = await api("/teams/" + encodeURIComponent(teamId));
    if (res.ok) {
      const body = await res.json();
      setTeam(body.team);
      setName(body.team.name);
    }
  };
  useEffect(() => { load(); }, [teamId]);

  if (!team) {
    return (
      <div className="fm-sheet-bg" onClick={onClose}>
        <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="fm-sheet-handle" />
          <div className="fm-spinner" />
        </div>
      </div>
    );
  }

  const isOwner = team.role === "owner";

  const setRole = async (memberEmail, role) => {
    setBusy(true);
    setMsg(null);
    const m = team.members.find((x) => x.email === memberEmail);
    const res = await api(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberEmail)}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    if (res.ok) await load();
    else setMsg({ type: "err", text: "No se pudo cambiar el rol" });
    setBusy(false);
  };

  const removeMember = async (memberEmail) => {
    setBusy(true);
    const res = await api(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberEmail)}`, { method: "DELETE" });
    if (res.ok) await load();
    setBusy(false);
  };

  const regenerate = async () => {
    setBusy(true);
    const res = await api(`/teams/${encodeURIComponent(teamId)}/code`, { method: "POST" });
    if (res.ok) await load();
    setBusy(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(team.shareCode.toUpperCase());
      setMsg({ type: "ok", text: "Código copiado" });
    } catch {
      setMsg({ type: "ok", text: "Código: " + team.shareCode.toUpperCase() });
    }
  };

  const rename = async () => {
    if (!name.trim() || name.trim() === team.name) return;
    setBusy(true);
    const res = await api("/teams/" + encodeURIComponent(teamId), { method: "PUT", body: JSON.stringify({ name: name.trim() }) });
    if (res.ok) await load();
    setBusy(false);
  };

  const deleteTeam = async () => {
    setBusy(true);
    const res = await api("/teams/" + encodeURIComponent(teamId), { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      onClose();
    } else {
      setMsg({ type: "err", text: body.error || "No se pudo borrar" });
      setConfirmDelete(false);
    }
    setBusy(false);
  };

  return (
    <div className="fm-sheet-bg" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div>
            <div className="fm-sheet-title">Ajustes del equipo</div>
            <div style={{ fontSize: 12.5, color: "var(--soft)", fontWeight: 600 }}>{team.name}</div>
          </div>
          <button className="fm-xbtn" onClick={onClose}>✕</button>
        </div>
        <div className="fm-sheet-body">
          <span className="fm-label2">Con quién está compartido ({team.members.length})</span>
          {team.members.map((m) => (
            <div key={m.email} className="fm-member-row">
              <div className="fm-avatar">{(m.email[0] || "?").toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                <div style={{ fontSize: 11.5, color: "var(--soft)" }}>
                  {m.isOwner ? "Propietario" : ROLE_LABEL[m.role]}
                  {m.isMe ? " · tú" : ""}
                </div>
              </div>
              {isOwner && !m.isOwner ? (
                <>
                  <select
                    className="fm-select"
                    value={m.role}
                    onChange={(e) => setRole(m.email, e.target.value)}
                    disabled={busy}
                  >
                    <option value="viewer">Solo lectura</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button className="fm-xbtn" title="Expulsar" onClick={() => removeMember(m.email)} disabled={busy} style={{ color: "var(--red)" }}>
                    ✕
                  </button>
                </>
              ) : (
                <span className={`fm-role fm-role-${m.role}`}>{m.isOwner ? "Owner" : ROLE_LABEL[m.role]}</span>
              )}
            </div>
          ))}
          {team.members.length === 1 && (
            <p className="fm-hint" style={{ marginTop: 10 }}>Todavía no lo has compartido con nadie.</p>
          )}

          <span className="fm-label2">Invitar con código</span>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="fm-code-box">{team.shareCode.toUpperCase()}</div>
            <button className="fm-teams-btn primary" style={{ flex: "0 0 auto", padding: "0 16px" }} onClick={copyCode}>
              Copiar
            </button>
          </div>
          <p className="fm-hint" style={{ marginTop: 8 }}>
            Quien use este código entra como <b>solo lectura</b>. {isOwner ? "Puedes cambiar su rol arriba." : ""}
          </p>
          {isOwner && (
            <button className="fm-teams-btn" style={{ marginTop: 10 }} onClick={regenerate} disabled={busy}>
              Generar código nuevo (revoca el anterior)
            </button>
          )}

          {msg && <div className={msg.type === "err" ? "fm-err" : "fm-ok"}>{msg.text}</div>}

          {isOwner && (
            <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--hair)" }}>
              <span className="fm-label2">Administración</span>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input className="fm-input2" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
                <button className="fm-teams-btn" style={{ flex: "0 0 auto", padding: "0 16px" }} onClick={rename} disabled={busy || name.trim() === team.name}>
                  Renombrar
                </button>
              </div>
              {confirmDelete ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="fm-teams-btn" style={{ flex: 1, color: "var(--red)" }} onClick={deleteTeam} disabled={busy}>
                    Confirmar borrado
                  </button>
                  <button className="fm-teams-btn" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancelar</button>
                </div>
              ) : (
                <button className="fm-teams-btn" style={{ color: "var(--red)" }} onClick={() => setConfirmDelete(true)}>
                  Borrar equipo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
