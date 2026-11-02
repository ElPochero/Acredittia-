-- 19_certificacion_laboral_v2.sql
-- Idempotente: Extender esquema de periodos laborales, requisitos por contrato y versionado

DO $$ BEGIN
    -- periodo_estado: en_auditoria
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'periodo_estado' AND e.enumlabel = 'en_auditoria'
    ) THEN
        ALTER TYPE periodo_estado ADD VALUE 'en_auditoria';
    END IF;

    -- periodo_doc_estado: vencido
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'periodo_doc_estado' AND e.enumlabel = 'vencido'
    ) THEN
        ALTER TYPE periodo_doc_estado ADD VALUE 'vencido';
    END IF;

    -- periodo_doc_estado: no_aplica
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'periodo_doc_estado' AND e.enumlabel = 'no_aplica'
    ) THEN
        ALTER TYPE periodo_doc_estado ADD VALUE 'no_aplica';
    END IF;
END $$;

-- 1. Extender periodos_laborales
ALTER TABLE periodos_laborales
    ADD COLUMN IF NOT EXISTS mes_anio VARCHAR(7),
    ADD COLUMN IF NOT EXISTS fecha_limite DATE,
    ADD COLUMN IF NOT EXISTS nomina_snapshot JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS cerrado_por UUID REFERENCES users(id) ON DELETE SET NULL;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_periodos_laborales_contrato_mes'
    ) THEN
        ALTER TABLE periodos_laborales ADD CONSTRAINT uq_periodos_laborales_contrato_mes UNIQUE (contrato_id, mes_anio);
    END IF;
END $$;

-- 2. Permitir sujeto_id NULL para documentos consolidados de contrato
ALTER TABLE periodo_documentos ALTER COLUMN sujeto_id DROP NOT NULL;

ALTER TABLE periodo_documentos
    ADD COLUMN IF NOT EXISTS contrato_requisito_id UUID,
    ADD COLUMN IF NOT EXISTS nombre TEXT,
    ADD COLUMN IF NOT EXISTS ambito VARCHAR(20) DEFAULT 'trabajador';

-- 3. Tabla de requisitos laborales configurables a nivel de contrato
CREATE TABLE IF NOT EXISTS contrato_requisitos_laborales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    ambito VARCHAR(20) NOT NULL CHECK (ambito IN ('contrato', 'trabajador')),
    fuente VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (fuente IN ('manual', 'buk')),
    obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
    regla_no_aplica VARCHAR(20) NOT NULL DEFAULT 'excluir' CHECK (regla_no_aplica IN ('excluir', 'cumplido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT uq_contrato_req_nombre UNIQUE (contrato_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_contrato_req_contrato_id ON contrato_requisitos_laborales(contrato_id);

-- 4. Tabla de versiones para el historial de entregas de documentos
CREATE TABLE IF NOT EXISTS periodo_documento_versiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_documento_id UUID NOT NULL REFERENCES periodo_documentos(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    archivo_url TEXT,
    archivo_nombre TEXT,
    subido_por UUID REFERENCES users(id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'en_revision',
    observacion TEXT,
    revisado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    abierto_por_adc BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_periodo_doc_versiones_doc ON periodo_documento_versiones(periodo_documento_id);

-- 5. Pre-sembrar los 10 requisitos oficiales de CL_DOCS para los contratos existentes
INSERT INTO contrato_requisitos_laborales (id, contrato_id, nombre, ambito, fuente, obligatorio, regla_no_aplica)
SELECT 
    gen_random_uuid(),
    c.id,
    r.nombre,
    r.ambito,
    r.fuente,
    r.obligatorio,
    r.regla_no_aplica
FROM contratos c
CROSS JOIN (
    VALUES
        ('F30-1 (Certificado de Antecedentes Laborales y Previsionales)', 'contrato', 'manual', TRUE, 'excluir'),
        ('Planilla y Comprobante de Pago Previsionales (Previred)', 'contrato', 'manual', TRUE, 'excluir'),
        ('Libro de Remuneraciones Electrónico (LRE)', 'contrato', 'buk', TRUE, 'excluir'),
        ('Certificado F30 (Cumplimiento de Obligaciones Laborales)', 'contrato', 'manual', TRUE, 'excluir'),
        ('Liquidaciones de Sueldo Firmadas', 'trabajador', 'buk', TRUE, 'excluir'),
        ('Comprobantes de Pago de Remuneraciones', 'trabajador', 'manual', TRUE, 'excluir'),
        ('Libro de Asistencia y Control de Jornada', 'trabajador', 'manual', TRUE, 'excluir'),
        ('Contratos de Trabajo y Anexos del Período', 'trabajador', 'buk', TRUE, 'excluir'),
        ('Finiquitos y Ratificaciones del Mes', 'trabajador', 'manual', TRUE, 'excluir'),
        ('Comprobante de Vacaciones y Feriado Legal', 'trabajador', 'buk', FALSE, 'excluir')
) AS r(nombre, ambito, fuente, obligatorio, regla_no_aplica)
ON CONFLICT (contrato_id, nombre) DO NOTHING;

