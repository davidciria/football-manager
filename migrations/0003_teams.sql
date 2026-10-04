-- Football Manager: equipos múltiples con roles (estilo Drive)
-- - teams: un espacio de datos compartido.
-- - team_members: quién pertenece y con qué rol (owner/editor/viewer).
-- - user_data pasa a colgar de team_id.
-- - users guarda el equipo activo.

CREATE TABLE IF NOT EXISTS teams (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  share_code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'viewer',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_share_code ON teams(share_code);

-- El equipo activo del usuario (por defecto, su equipo personal).
ALTER TABLE users ADD COLUMN active_team_id TEXT;

-- Nota: user_data se conserva con su estructura (user_id = id de equipo dueño);
-- en la migración de datos, "user_id" pasará a contener el team_id.
