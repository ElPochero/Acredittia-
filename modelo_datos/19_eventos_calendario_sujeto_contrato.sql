-- ============================================================================
-- ACREDITTIA — 19_eventos_calendario_sujeto_contrato.sql
-- Vínculo contextual de agendamientos (exámenes y cursos) con sujeto y contrato.
-- ============================================================================

ALTER TABLE eventos_calendario
  ADD COLUMN IF NOT EXISTS sujeto_id UUID REFERENCES sujetos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS centro_atencion TEXT,
  ADD COLUMN IF NOT EXISTS enviar_notificacion BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_eventos_calendario_sujeto ON eventos_calendario (sujeto_id);
CREATE INDEX IF NOT EXISTS ix_eventos_calendario_contrato ON eventos_calendario (contrato_id);

INSERT INTO app_schema_migrations (version) VALUES (19) ON CONFLICT DO NOTHING;
