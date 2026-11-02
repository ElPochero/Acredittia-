-- ============================================================================
-- ACREDITTIA — 18_contratos_mandante.sql
-- Mandante libre por contrato (H-19, Feedback 17-10 Punto 15).
--
-- Permite definir libremente la empresa mandante en el contrato, manteniendo
-- compatibilidad con el mandante heredado de la faena.
-- El mandante efectivo es COALESCE(NULLIF(TRIM(contratos.mandante), ''), faenas.mandante).
-- ============================================================================

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS mandante TEXT;

CREATE INDEX IF NOT EXISTS ix_contratos_mandante ON contratos (mandante);

-- Compatibilidad con Administración (Pre-Merge v18): revocación de sesión y ciclo de vida
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS ciclo_estado text NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS ciclo_actualizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS ciclo_motivo text,
  ADD COLUMN IF NOT EXISTS ciclo_actor_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_contratos_company_ciclo ON contratos (company_id, ciclo_estado, nombre);
CREATE INDEX IF NOT EXISTS ix_contratos_ciclo_actor ON contratos (ciclo_actor_id);

INSERT INTO app_schema_migrations (version) VALUES (18) ON CONFLICT DO NOTHING;
