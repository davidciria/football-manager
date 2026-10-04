import React, { useState } from "react";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
.fm-auth{
  --deep:#0E2019; --mid:#153A2C; --mid2:#1E4D3B; --line:#F2FAF5;
  --soft:#A9CBBB; --faint:#7C9C8A; --amber:#F5B23F; --amber-ink:#3A2405;
  --red:#FF5A4D; --hair:rgba(234,244,238,0.12); --hair2:rgba(234,244,238,0.26);
  height:100vh; height:100dvh; width:100%; display:flex; align-items:center; justify-content:center;
  overflow-y:auto;
  background:radial-gradient(1200px 600px at 50% -10%, var(--mid2), var(--deep) 60%);
  color:var(--line); font-family:'Manrope',system-ui,sans-serif;
  padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));
  box-sizing:border-box;
}
.fm-auth *{box-sizing:border-box;}
.fm-auth-card{
  width:100%; max-width:400px; margin:auto; background:linear-gradient(180deg,var(--mid),var(--deep));
  border:1px solid var(--hair2); border-radius:22px; padding:28px 24px 24px;
  box-shadow:0 24px 60px rgba(0,0,0,0.45);
}
.fm-auth-logo{
  display:flex; align-items:center; gap:12px; margin-bottom:22px;
}
.fm-auth-ball{
  width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center;
  background:var(--amber); color:var(--amber-ink); font-size:24px;
}
.fm-auth-title{font-family:'Teko',sans-serif; font-weight:700; font-size:30px; line-height:0.95; letter-spacing:0.02em;}
.fm-auth-sub{font-size:12.5px; color:var(--soft); font-weight:600;}
.fm-auth-h{font-size:19px; font-weight:800; margin:0 0 4px;}
.fm-auth-p{font-size:13px; color:var(--soft); margin:0 0 18px; line-height:1.45;}
.fm-field{margin-bottom:14px;}
.fm-field label{display:block; font-size:12px; font-weight:700; color:var(--soft); margin-bottom:6px; letter-spacing:0.02em;}
.fm-input{
  width:100%; padding:13px 14px; border-radius:12px; font-size:16px; font-family:inherit; font-weight:600;
  background:#0A1812; border:1px solid var(--hair2); color:#FFFFFF; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.fm-input::placeholder{color:var(--faint);}
.fm-input:focus{border-color:var(--amber); box-shadow:0 0 0 3px rgba(245,178,63,0.20);}
.fm-auth-btn{
  width:100%; margin-top:6px; padding:14px; border:none; border-radius:12px; cursor:pointer;
  background:var(--amber); color:var(--amber-ink); font-family:inherit; font-weight:800; font-size:15px;
  display:flex; align-items:center; justify-content:center; gap:8px; min-height:48px;
  transition:transform .06s ease, filter .15s ease;
}
.fm-auth-btn:hover{filter:brightness(1.05);}
.fm-auth-btn:active{transform:scale(0.99);}
.fm-auth-btn:disabled{opacity:0.6; cursor:not-allowed;}
.fm-auth-err{
  background:rgba(228,72,60,0.14); border:1px solid rgba(228,72,60,0.4); color:#FFC9C4;
  border-radius:10px; padding:10px 12px; font-size:13px; font-weight:600; margin-bottom:14px;
}
.fm-auth-ok{
  background:rgba(79,169,232,0.14); border:1px solid rgba(79,169,232,0.4); color:#CFE9FF;
  border-radius:10px; padding:10px 12px; font-size:13px; font-weight:600; margin-bottom:14px;
}
.fm-auth-toggle{margin-top:16px; text-align:center; font-size:13px; color:var(--soft);}
.fm-auth-toggle button{
  background:none; border:none; color:var(--amber); font-family:inherit; font-weight:800; font-size:13px;
  cursor:pointer; padding:4px; text-decoration:underline; text-underline-offset:3px;
}
.fm-spinner{
  width:40px; height:40px; border-radius:50%; border:3px solid rgba(255,255,255,0.18);
  border-top-color:var(--amber); animation:fmauthspin .8s linear infinite;
}
@keyframes fmauthspin{to{transform:rotate(360deg);}}
`;

export function Splash() {
  return (
    <div className="fm-auth">
      <style>{CSS}</style>
      <div className="fm-spinner" />
    </div>
  );
}

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/" + (isRegister ? "register" : "login"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "No se pudo completar la operación");
        setBusy(false);
        return;
      }
      await onAuthed(body.user);
    } catch {
      setError("Error de conexión con el servidor");
      setBusy(false);
    }
  }

  return (
    <div className="fm-auth">
      <style>{CSS}</style>
      <form className="fm-auth-card" onSubmit={submit}>
        <div className="fm-auth-logo">
          <div className="fm-auth-ball">&#9917;</div>
          <div>
            <div className="fm-auth-title">FOOTBALL MANAGER</div>
            <div className="fm-auth-sub">Banquillo táctico</div>
          </div>
        </div>

        <h1 className="fm-auth-h">{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h1>
        <p className="fm-auth-p">
          {isRegister
            ? "Regístrate para guardar tu plantilla, partidos, historial y pizarras en la nube."
            : "Accede para recuperar tus datos guardados."}
        </p>

        {error && <div className="fm-auth-err">{error}</div>}

        <div className="fm-field">
          <label htmlFor="fm-email">Correo electrónico</label>
          <input
            id="fm-email"
            className="fm-input"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="fm-field">
          <label htmlFor="fm-password">Contraseña</label>
          <input
            id="fm-password"
            className="fm-input"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder={isRegister ? "Mínimo 8 caracteres" : "Tu contraseña"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
          />
        </div>

        <button className="fm-auth-btn" type="submit" disabled={busy}>
          {busy ? "…" : isRegister ? "Registrarme" : "Entrar"}
        </button>

        <div className="fm-auth-toggle">
          {isRegister ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <button
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
          >
            {isRegister ? "Inicia sesión" : "Regístrate"}
          </button>
        </div>
      </form>
    </div>
  );
}
