-- Football Manager: equipos compartidos
-- Varios usuarios pueden apuntar al mismo "workspace" (data_owner_id) y
-- compartir plantilla, partidos, pizarras, etc.

ALTER TABLE users ADD COLUMN data_owner_id TEXT;
ALTER TABLE users ADD COLUMN share_code TEXT;

-- Los usuarios existentes son dueños de sus propios datos.
UPDATE users SET data_owner_id = id WHERE data_owner_id IS NULL;
-- Código de invitación corto derivado del id (se regenera aleatorio en altas nuevas).
UPDATE users SET share_code = substr(replace(id, '-', ''), 1, 8) WHERE share_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_share_code ON users(share_code);
CREATE INDEX IF NOT EXISTS idx_users_data_owner ON users(data_owner_id);
