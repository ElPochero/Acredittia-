DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodo_tipo') THEN
        CREATE TYPE periodo_tipo AS ENUM ('mensual', 'quincenal', 'otro');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodo_estado') THEN
        CREATE TYPE periodo_estado AS ENUM ('abierto', 'en_revision', 'cerrado', 'en_auditoria');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodo_doc_estado') THEN
        CREATE TYPE periodo_doc_estado AS ENUM ('pendiente', 'cargado', 'en_revision', 'aprobado', 'observado', 'rechazado', 'vencido', 'no_aplica');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auditoria_accion') THEN
        CREATE TYPE auditoria_accion AS ENUM ('aprobar', 'observar', 'rechazar', 'cargar', 'no_aplica');
    END IF;
END $$;

ALTER TYPE periodo_estado ADD VALUE IF NOT EXISTS 'en_auditoria';
ALTER TYPE periodo_doc_estado ADD VALUE IF NOT EXISTS 'vencido';
ALTER TYPE periodo_doc_estado ADD VALUE IF NOT EXISTS 'no_aplica';
ALTER TYPE auditoria_accion ADD VALUE IF NOT EXISTS 'cargar';
ALTER TYPE auditoria_accion ADD VALUE IF NOT EXISTS 'no_aplica';
ALTER TYPE integracion_tipo ADD VALUE IF NOT EXISTS 'buk';

CREATE TABLE IF NOT EXISTS periodos_laborales (
    id UUID PRIMARY KEY,
    contrato_id UUID NOT NULL REFERENCES contratos(id),
    nombre TEXT NOT NULL,
    tipo periodo_tipo NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado periodo_estado NOT NULL,
    porcentaje_cumplimiento NUMERIC(5,2) NOT NULL,
    mes_anio VARCHAR(7),
    fecha_limite DATE,
    nomina_snapshot JSONB DEFAULT '[]'::jsonb,
    cerrado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_periodos_laborales_contrato_mes UNIQUE (contrato_id, mes_anio)
);

CREATE INDEX IF NOT EXISTS ix_periodos_cerrado_por ON periodos_laborales (cerrado_por);

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

CREATE INDEX IF NOT EXISTS idx_contrato_req_contrato_id ON contrato_requisitos_laborales (contrato_id);

CREATE TABLE IF NOT EXISTS periodo_documentos_requeridos (
    id UUID PRIMARY KEY,
    periodo_id UUID NOT NULL REFERENCES periodos_laborales(id),
    requisito_template_id UUID NOT NULL REFERENCES requisito_templates(id),
    ambito req_ambito NOT NULL,
    obligatorio BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS periodo_documentos (
    id UUID PRIMARY KEY,
    periodo_id UUID NOT NULL REFERENCES periodos_laborales(id),
    sujeto_id UUID REFERENCES sujetos(id),
    requisito_template_id UUID REFERENCES requisito_templates(id),
    contrato_requisito_id UUID REFERENCES contrato_requisitos_laborales(id) ON DELETE CASCADE,
    nombre TEXT,
    ambito VARCHAR(20) DEFAULT 'trabajador',
    archivo_url TEXT,
    estado periodo_doc_estado NOT NULL,
    fecha_carga TIMESTAMP WITH TIME ZONE,
    cargado_por UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_periodo_doc_contrato_req ON periodo_documentos (contrato_requisito_id);

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

CREATE INDEX IF NOT EXISTS idx_periodo_doc_versiones_doc ON periodo_documento_versiones (periodo_documento_id);
CREATE INDEX IF NOT EXISTS ix_periodo_doc_versiones_subido_por ON periodo_documento_versiones (subido_por);
CREATE INDEX IF NOT EXISTS ix_periodo_doc_versiones_revisado_por ON periodo_documento_versiones (revisado_por);

CREATE TABLE IF NOT EXISTS auditoria_documentos (
    id UUID PRIMARY KEY,
    periodo_documento_id UUID NOT NULL REFERENCES periodo_documentos(id) ON DELETE CASCADE,
    auditor_id UUID NOT NULL REFERENCES users(id),
    accion auditoria_accion NOT NULL,
    observacion TEXT,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contrato_usuarios_rol (
    contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rol_contrato VARCHAR(20) NOT NULL DEFAULT 'rrhh',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (contrato_id, user_id, rol_contrato)
);

CREATE INDEX IF NOT EXISTS idx_contrato_usuarios_rol_user ON contrato_usuarios_rol (user_id);
CREATE INDEX IF NOT EXISTS idx_contrato_usuarios_rol_contrato ON contrato_usuarios_rol (contrato_id);

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

INSERT INTO app_schema_migrations (version) VALUES (9) ON CONFLICT DO NOTHING;
