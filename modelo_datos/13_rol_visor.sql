-- ============================================================================
-- 13. Rol 'visor' y roles de Control Laboral ('adc', 'rrhh') (C20 / Dev 4)
-- ============================================================================
-- El script es IDEMPOTENTE: puede reejecutarse sin efectos adversos.
-- Las líneas ALTER TYPE ... ADD VALUE van solas para que _preparar_script() las
-- ejecute en autocommit (el valor nuevo no puede usarse en la misma
-- transacción que lo crea). El CHECK se reescribe: el contrato pasa a ser
-- obligatorio para contract_admin/visor, nulo para admin/company, y opcional
-- para adc/rrhh (que pueden operar vía contrato_usuarios_rol).
-- ============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'visor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'adc';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'rrhh';

ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_contrato;
ALTER TABLE users ADD CONSTRAINT ck_users_contrato
  CHECK (
    (role IN ('contract_admin', 'visor') AND contrato_id IS NOT NULL)
    OR (role IN ('admin', 'company') AND contrato_id IS NULL)
    OR (role IN ('adc', 'rrhh'))
  );


INSERT INTO app_schema_migrations (version) VALUES (13) ON CONFLICT DO NOTHING;
