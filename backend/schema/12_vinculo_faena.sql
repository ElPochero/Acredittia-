-- ============================================================================
-- 12. Vínculo 'faena' para requisitos de Documentos de Faena (C8)
-- ============================================================================
-- El script es IDEMPOTENTE: puede reejecutarse sin efectos adversos.
-- Sigue el patrón de 06_migracion_v11.sql §1.1: una sola línea ALTER TYPE,
-- que _preparar_script() ejecuta en autocommit (el valor nuevo no puede
-- usarse dentro de la misma transacción que lo crea).
-- ============================================================================

ALTER TYPE vinculo_tipo ADD VALUE IF NOT EXISTS 'faena';
