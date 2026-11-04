-- 14 — Unidad de Negocio
--
-- El contrato pertenece a una UNIDAD DE NEGOCIO (Transporte de Personal,
-- Mantención, Obras Civiles...). La unidad es un eje transversal a la faena:
-- agrupa los contratos de una misma empresa y da acceso automático a los
-- encargados jerárquicos designados para ella (`users.unidad_negocio`).
--
-- El catálogo de unidades vive en el código (`contratos.UNIDADES_NEGOCIO`): es
-- un conjunto cerrado y corto, no merece su propia tabla ni una FK.

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS unidad_negocio TEXT;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS unidad_negocio TEXT;

CREATE INDEX IF NOT EXISTS ix_contratos_unidad_negocio ON contratos (unidad_negocio);
CREATE INDEX IF NOT EXISTS ix_users_unidad_negocio    ON users (unidad_negocio);


INSERT INTO app_schema_migrations (version) VALUES (15) ON CONFLICT DO NOTHING;
