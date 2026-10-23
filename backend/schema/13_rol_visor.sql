-- ============================================================================
-- 13. Rol 'visor': lectura acotada a un contrato (C20)
-- ============================================================================
-- El script es IDEMPOTENTE: puede reejecutarse sin efectos adversos.
-- La línea ALTER TYPE ... ADD VALUE va sola para que _preparar_script() la
-- ejecute en autocommit (el valor nuevo no puede usarse en la misma
-- transacción que lo crea). El CHECK se reescribe: el contrato pasa a ser
-- obligatorio y exclusivo de los roles acotados (contract_admin, visor).
-- ============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'visor';

ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_contrato;
ALTER TABLE users ADD CONSTRAINT ck_users_contrato
  CHECK ( (role IN ('contract_admin', 'visor')) = (contrato_id IS NOT NULL) );
