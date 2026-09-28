/* ----------------------------------------------------------------------------
   Persistencia respaldada por la API (Cloudflare Worker + D1).
   Implementa el mismo contrato que usaba el artifact (`window.storage`), pero
   guardando en el servidor por usuario. Mantiene una copia en localStorage
   como caché/offline.
---------------------------------------------------------------------------- */

const LS_PREFIX = "football-manager:";
const mem = {};

export const DATA_KEYS = [
  "squad",
  "templates",
  "active-match",
  "history",
  "settings",
  "boards",
];

function readLocal(key) {
  try {
    return localStorage.getItem(LS_PREFIX + key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(LS_PREFIX + key);
    else localStorage.setItem(LS_PREFIX + key, value);
  } catch {
    /* ignore */
  }
}

async function api(path, options = {}) {
  return fetch("/api" + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

export function installStorage() {
  window.storage = {
    async get(key) {
      try {
        const res = await api("/data/" + encodeURIComponent(key));
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("http " + res.status);
        const body = await res.json();
        mem[key] = body.value;
        writeLocal(key, body.value);
        return { key, value: body.value, shared: false };
      } catch {
        if (key in mem) return { key, value: mem[key], shared: false };
        const local = readLocal(key);
        if (local !== null) return { key, value: local, shared: false };
        return null;
      }
    },

    async set(key, value) {
      mem[key] = value;
      writeLocal(key, value);
      const res = await api("/data/" + encodeURIComponent(key), {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("No se pudo guardar en el servidor");
      return { key, value, shared: false };
    },

    async delete(key) {
      delete mem[key];
      writeLocal(key, null);
      await api("/data/" + encodeURIComponent(key), { method: "DELETE" });
      return { key, deleted: true, shared: false };
    },
  };
}

/* Sube a la cuenta los datos que solo existían en local (primer login). */
export async function migrateLocalToServer() {
  for (const key of DATA_KEYS) {
    const local = readLocal(key);
    if (local === null) continue;
    try {
      const res = await api("/data/" + encodeURIComponent(key));
      if (res.status === 404) {
        await api("/data/" + encodeURIComponent(key), {
          method: "PUT",
          body: JSON.stringify({ value: local }),
        });
      }
    } catch {
      /* ignore */
    }
  }
}

export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
}

/* Borra la caché local para no filtrar datos entre cuentas distintas. */
export function clearLocalCache() {
  for (const key of Object.keys(mem)) delete mem[key];
  for (const key of DATA_KEYS) writeLocal(key, null);
}
