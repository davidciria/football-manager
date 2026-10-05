import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AuthScreen, { Splash } from "./AuthScreen.jsx";
import TeamsScreen from "./TeamsScreen.jsx";
import { installStorage, migrateLocalToServer, clearLocalCache, logout } from "./storage.js";

/* El artifact original persistía con window.storage (Claude Artifacts).
   Aquí lo respaldamos con la API del Worker (Cloudflare D1) por equipo. */
installStorage();

/* ----------------------------------------------------------------------------
   iOS/Safari: con <meta viewport interactive-widget=resizes-content> el layout
   viewport se encoge al abrir el teclado, así que los overlay fixed (inset:0)
   ya encajan. Aquí solo mantenemos el scroll del documento a 0 (Safari a veces
   lo deja desplazado al cerrar el teclado) y exponemos --fm-inset por si algo
   lo necesita.
---------------------------------------------------------------------------- */
export function stableViewportHeight() {
  const ch = document.documentElement.clientHeight;
  return ch && ch > 0 ? ch : Math.max(window.innerHeight || 0, window.visualViewport?.height || 0);
}

export function keyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(stableViewportHeight() - vv.height - (vv.offsetTop || 0)));
}

function installViewportVars() {
  const root = document.documentElement;
  const vv = window.visualViewport;

  const update = () => {
    root.style.setProperty("--fm-inset", Math.round(keyboardInset()) + "px");
  };

  // Safari deja el documento desplazado tras cerrar el teclado: lo devolvemos a 0.
  const resetScroll = () => {
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  };

  update();
  if (vv) {
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
  }
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", () => setTimeout(() => { update(); resetScroll(); }, 80));
  window.addEventListener("focusout", () => setTimeout(resetScroll, 120));
}
installViewportVars();

function Root() {
  const [status, setStatus] = useState("loading"); // loading | anon | teams | app
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null); // { id, name, role }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!alive) return;
        if (res.ok) {
          const body = await res.json();
          setUser(body.user);
          setStatus("teams");
        } else {
          setStatus("anon");
        }
      } catch {
        if (alive) setStatus("anon");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleAuthed = async (u) => {
    await migrateLocalToServer();
    setUser(u);
    setTeam(null);
    setStatus("teams");
  };

  const handleLogout = async () => {
    await logout();
    clearLocalCache();
    setUser(null);
    setTeam(null);
    setStatus("anon");
  };

  const openTeam = async (teamId) => {
    try {
      await fetch("/api/teams/active", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const res = await fetch("/api/teams/" + encodeURIComponent(teamId), { credentials: "same-origin" });
      const body = await res.json();
      setTeam({ id: body.team.id, name: body.team.name, role: body.team.role });
      clearLocalCache();
      setStatus("app");
    } catch {
      /* ignore */
    }
  };

  const backToTeams = () => {
    clearLocalCache();
    setTeam(null);
    setStatus("teams");
  };

  const renameTeam = async (newName) => {
    const res = await fetch("/api/teams/" + encodeURIComponent(team.id), {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setTeam((t) => (t ? { ...t, name: newName } : t));
      return true;
    }
    return false;
  };

  if (status === "loading") return <Splash />;
  if (status === "anon") return <AuthScreen onAuthed={handleAuthed} />;
  if (status === "teams")
    return <TeamsScreen user={user} onOpenTeam={openTeam} onLogout={handleLogout} />;
  return (
    <App
      user={user}
      team={team}
      onLogout={handleLogout}
      onSwitchTeam={backToTeams}
      onRenameTeam={team?.role === "owner" ? renameTeam : null}
    />
  );
}

createRoot(document.getElementById("root")).render(<Root />);
