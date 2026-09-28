# Football Manager

Artifact de Claude replicado como aplicación local con **React + Vite**, con
persistencia real en base de datos y autenticación por email/contraseña.

- **App desplegada:** https://football-manager.latos.workers.dev
- **Frontend:** React (componente del artifact original en `src/App.jsx`)
- **Backend:** Cloudflare Worker (`worker/src/index.js`) sirviendo la API y los assets
- **Base de datos:** Cloudflare D1 (`migrations/0001_init.sql`)

## Funcionalidad

- Registro e inicio de sesión con email + contraseña.
  - Contraseñas hasheadas con **PBKDF2-SHA256** (100.000 iteraciones, salt por usuario).
  - Sesiones opacas en D1, cookie `HttpOnly; Secure; SameSite=Lax` (30 días).
- Persistencia por usuario de: plantilla, alineaciones, partido activo, historial,
  pizarras y ajustes (tabla `user_data`).
- Migración automática: si había datos en `localStorage` de una versión previa,
  se suben a la cuenta en el primer login.

## Desarrollo local

```bash
npm install
npm run build
npm run dev:worker     # build + wrangler dev en http://localhost:8787 (API + frontend + D1 local)
```

Solo frontend (sin API):

```bash
npm run dev
```

## Despliegue

```bash
# Autenticación con wrangler (una vez):
#   CLOUDFLARE_EMAIL=...  CLOUDFLARE_API_KEY=...  (Global API Key)
#   o mejor: CLOUDFLARE_API_TOKEN=...

npm run db:migrate:remote   # aplica migraciones a D1 remoto
npm run deploy              # build + wrangler deploy
```

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/auth/register` | Crear cuenta `{ email, password }` |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/data` | Todos los datos del usuario |
| GET/PUT/DELETE | `/api/data/:key` | Leer/guardar/borrar una clave |

Claves permitidas: `squad`, `templates`, `active-match`, `history`, `settings`, `boards`.
