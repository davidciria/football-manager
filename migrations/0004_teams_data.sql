-- Datos: para cada "workspace" existente (grupo de users con el mismo
-- data_owner_id) crear un equipo, añadir a sus miembros y mover sus datos.

-- 1) Crear un equipo por cada dueño de datos existente.
INSERT INTO teams (id, name, owner_id, share_code, created_at)
SELECT
  'team_' || u.data_owner_id,
  'Mi equipo',
  u.data_owner_id,
  COALESCE(u.share_code, substr(replace(u.data_owner_id,'-',''),1,8)),
  CAST(strftime('%s','now') AS INTEGER)
FROM users u
WHERE u.id = u.data_owner_id
  AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = 'team_' || u.data_owner_id);

-- 2) Añadir miembros con rol. El dueño es owner; el resto editor.
INSERT OR IGNORE INTO team_members (team_id, user_id, role, created_at)
SELECT
  'team_' || u.data_owner_id,
  u.id,
  CASE WHEN u.id = u.data_owner_id THEN 'owner' ELSE 'editor' END,
  CAST(strftime('%s','now') AS INTEGER)
FROM users u
LEFT JOIN team_members tm ON tm.team_id = 'team_' || u.data_owner_id AND tm.user_id = u.id
WHERE tm.user_id IS NULL;

-- 3) Cada usuario activa su equipo.
UPDATE users
SET active_team_id = 'team_' || data_owner_id
WHERE active_team_id IS NULL;

-- 4) Reconstruir user_data para que user_id apunte al team_id del workspace
--    (mapeando cada fila al dueño de datos de su usuario). Se insertan primero
--    los datos de los usuarios NO dueños y al final los del dueño, de modo que
--    si hay colisión de claves, ganan los del dueño (fuente de verdad).
CREATE TABLE IF NOT EXISTS user_data_new (
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES teams(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO user_data_new (user_id, key, value, updated_at)
SELECT 'team_' || u.data_owner_id, d.key, d.value, d.updated_at
FROM user_data d
JOIN users u ON u.id = d.user_id
ORDER BY CASE WHEN u.id = u.data_owner_id THEN 1 ELSE 0 END;

DROP TABLE user_data;
ALTER TABLE user_data_new RENAME TO user_data;
