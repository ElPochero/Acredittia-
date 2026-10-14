DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodo_tipo') THEN
        CREATE TYPE periodo_tipo AS ENUM ('mensual', 'quincenal', 'otro');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodo_estado') THEN
        CREATE TYPE periodo_estado AS ENUM ('abierto', 'en_revision', 'cerrado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodo_doc_estado') THEN
        CREATE TYPE periodo_doc_estado AS ENUM ('pendiente', 'cargado', 'en_revision', 'aprobado', 'observado', 'rechazado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auditoria_accion') THEN
        CREATE TYPE auditoria_accion AS ENUM ('aprobar', 'observar', 'rechazar');
    END IF;
END $$;

CREATE TABLE periodos_laborales (
    id UUID PRIMARY KEY,
    contrato_id UUID NOT NULL REFERENCES contratos(id),
    nombre TEXT NOT NULL,
    tipo periodo_tipo NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado periodo_estado NOT NULL,
    porcentaje_cumplimiento NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE periodo_documentos_requeridos (
    id UUID PRIMARY KEY,
    periodo_id UUID NOT NULL REFERENCES periodos_laborales(id),
    requisito_template_id UUID NOT NULL REFERENCES requisito_templates(id),
    ambito req_ambito NOT NULL,
    obligatorio BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE periodo_documentos (
    id UUID PRIMARY KEY,
    periodo_id UUID NOT NULL REFERENCES periodos_laborales(id),
    sujeto_id UUID NOT NULL REFERENCES sujetos(id),
    requisito_template_id UUID NOT NULL REFERENCES requisito_templates(id),
    archivo_url TEXT,
    estado periodo_doc_estado NOT NULL,
    fecha_carga TIMESTAMP WITH TIME ZONE,
    cargado_por UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE auditoria_documentos (
    id UUID PRIMARY KEY,
    periodo_documento_id UUID NOT NULL REFERENCES periodo_documentos(id),
    auditor_id UUID NOT NULL REFERENCES users(id),
    accion auditoria_accion NOT NULL,
    observacion TEXT,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    version INTEGER NOT NULL
);
