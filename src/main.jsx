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
   iOS/Safari: el teclado en pantalla y la barra inferior no forman parte del
   layout viewport. Calculamos el "inset" inferior real (teclado + barra) y lo
   exponemos como variable CSS.
---------------------------------------------------------------------------- */
function installViewportVars() {
  const root = document.documentElement;
  const vv = window.visualViewport;

  const update = () => {
    const layoutH = Math.max(window.innerHeight, document.documentElement.clientHeight);
    let inset = 0;
    if (vv) inset = Math.max(0, layoutH - vv.height - vv.offsetTop);
    root.style.setProperty("--fm-inset", Math.round(inset) + "px");
  };

  update();
  if (vv) {
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
  }
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  window.addEventListener("focusin", () => setTimeout(update, 50));
  window.addEventListener("focusout", () => setTimeout(update, 50));
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

  if (status === "loading") return <Splash />;
  if (status === "anon") return <AuthScreen onAuthed={handleAuthed} />;
  if (status === "teams")
    return <TeamsScreen user={user} onOpenTeam={openTeam} onLogout={handleLogout} />;
  return <App user={user} team={team} onLogout={handleLogout} onSwitchTeam={backToTeams} />;
}

createRoot(document.getElementById("root")).render(<Root />);
