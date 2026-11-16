-- ============================================================================
-- ACREDITTIA — 20_motor_validacion_ia_v2.sql
-- Motor común de validación documental por IA (v2):
--   - Nivel 1/2: clasificación de familia, tipo de documento y pauta en plantillas
--   - Nivel 3: overrides de reglas/umbrales por faena/contrato y equivalencias
--   - Fuente de verdad del titular en sujetos (cédula / padrón aprobado)
--   - Persistencia de salida estándar en ia_reviews
-- ============================================================================

-- 1. Nivel 1 y Nivel 2 en requisito_templates
ALTER TABLE requisito_templates
  ADD COLUMN IF NOT EXISTS familia_validacion TEXT,
  ADD COLUMN IF NOT EXISTS tipo_documento_ia TEXT,
  ADD COLUMN IF NOT EXISTS pauta_reglas JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Nivel 3: Overrides de reglas y umbrales por Faena / Contrato
CREATE TABLE IF NOT EXISTS faena_reglas_validacion (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  faena_id             UUID REFERENCES faenas(id) ON DELETE CASCADE,
  contrato_id          UUID REFERENCES contratos(id) ON DELETE CASCADE,
  tipo_documento_ia    TEXT NOT NULL,
  reglas_activas       JSONB NOT NULL DEFAULT '{}'::jsonb,
  bloqueantes_override JSONB NOT NULL DEFAULT '{}'::jsonb,
  parametros           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_faena_reglas_val_company
  ON faena_reglas_validacion (company_id);
CREATE INDEX IF NOT EXISTS ix_faena_reglas_val_faena
  ON faena_reglas_validacion (faena_id);
CREATE INDEX IF NOT EXISTS ix_faena_reglas_val_contrato
  ON faena_reglas_validacion (contrato_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_faena_reglas_val_scope
  ON faena_reglas_validacion (company_id, tipo_documento_ia, faena_id, contrato_id)
  NULLS NOT DISTINCT;

ALTER TABLE faena_reglas_validacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE faena_reglas_validacion FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant ON faena_reglas_validacion;
CREATE POLICY p_tenant ON faena_reglas_validacion
  FOR ALL
  USING (app_is_admin() OR company_id = app_company_id())
  WITH CHECK (app_is_admin() OR company_id = app_company_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON faena_reglas_validacion TO acredittia_app;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acredittia_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON faena_reglas_validacion TO acredittia_worker;
  END IF;
END $$;

-- 3. Nivel 3: Tabla de equivalencias de cursos y exámenes
CREATE TABLE IF NOT EXISTS equivalencias_validacion (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  faena_id         UUID REFERENCES faenas(id) ON DELETE CASCADE,
  familia          TEXT NOT NULL,
  nombre_detectado TEXT NOT NULL,
  nombre_canonico  TEXT NOT NULL,
  codigo_catalogo  TEXT,
  confianza        NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  confirmado       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_equiv_val_company
  ON equivalencias_validacion (company_id);
CREATE INDEX IF NOT EXISTS ix_equiv_val_faena
  ON equivalencias_validacion (faena_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_equivalencias_val_scope
  ON equivalencias_validacion (company_id, faena_id, familia, nombre_detectado) NULLS NOT DISTINCT;

ALTER TABLE equivalencias_validacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE equivalencias_validacion FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant ON equivalencias_validacion;
CREATE POLICY p_tenant ON equivalencias_validacion
  FOR ALL
  USING (app_is_admin() OR company_id = app_company_id())
  WITH CHECK (app_is_admin() OR company_id = app_company_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON equivalencias_validacion TO acredittia_app;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acredittia_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON equivalencias_validacion TO acredittia_worker;
  END IF;
END $$;

-- 4. Fuente de verdad del titular en sujetos (Cédula / Padrón aprobados)
ALTER TABLE sujetos
  ADD COLUMN IF NOT EXISTS datos_verificados JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 5. Salida estándar del motor v2 en ia_reviews
ALTER TABLE ia_reviews
  ADD COLUMN IF NOT EXISTS validation_status TEXT,
  ADD COLUMN IF NOT EXISTS rules_result JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS summary_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS motivo TEXT;

-- 6. Trigger updated_at en faena_reglas_validacion
DROP TRIGGER IF EXISTS trg_touch_faena_reglas_validacion ON faena_reglas_validacion;
CREATE TRIGGER trg_touch_faena_reglas_validacion
  BEFORE UPDATE ON faena_reglas_validacion
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

INSERT INTO app_schema_migrations (version) VALUES (20) ON CONFLICT DO NOTHING;
