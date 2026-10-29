-- ============================================================================
-- ACREDITTIA — 17_contratos_mandante.sql
-- Mandante libre por contrato (H-19, Feedback 17-10 Punto 15).
--
-- Permite definir libremente la empresa mandante en el contrato, manteniendo
-- compatibilidad con el mandante heredado de la faena.
-- El mandante efectivo es COALESCE(NULLIF(TRIM(contratos.mandante), ''), faenas.mandante).
-- ============================================================================

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS mandante TEXT;

CREATE INDEX IF NOT EXISTS ix_contratos_mandante ON contratos (mandante);
