import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AuthScreen, { Splash } from "./AuthScreen.jsx";
import { installStorage, migrateLocalToServer, clearLocalCache, logout } from "./storage.js";

/* El artifact original persistía con window.storage (Claude Artifacts).
   Aquí lo respaldamos con la API del Worker (Cloudflare D1) por usuario. */
installStorage();

/* ----------------------------------------------------------------------------
   iOS/Safari: el teclado en pantalla y la barra inferior no forman parte del
   layout viewport. Calculamos el "inset" inferior real (teclado + barra) y lo
   exponemos como variable CSS. Así el oscurecido cubre toda la pantalla y la
   hoja se eleva por encima del teclado ocupando el área visible.
---------------------------------------------------------------------------- */
function installViewportVars() {
  const root = document.documentElement;
  const vv = window.visualViewport;

  const update = () => {
    // Altura del layout viewport (no cambia con el teclado en iOS).
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
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!alive) return;
        if (res.ok) {
          const body = await res.json();
          setUser(body.user);
          setStatus("authed");
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
    setStatus("authed");
  };

  const handleLogout = async () => {
    await logout();
    clearLocalCache();
    setUser(null);
    setStatus("anon");
  };

  if (status === "loading") return <Splash />;
  if (status === "anon") return <AuthScreen onAuthed={handleAuthed} />;
  return <App user={user} onLogout={handleLogout} />;
}

createRoot(document.getElementById("root")).render(<Root />);
