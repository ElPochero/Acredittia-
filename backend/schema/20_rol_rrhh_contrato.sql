-- 20_rol_rrhh_contrato.sql
-- Control de acceso RBAC para "RR.HH. — solo Control Laboral" y asignación multi-contrato (Sección 3.1, 9, Día 5)

-- 1. Asegurar enum user_role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'company', 'contract_admin', 'visor', 'adc', 'rrhh');
    ELSE
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'adc';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'rrhh';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- 2. Tabla de asignación de usuarios y roles por contrato
CREATE TABLE IF NOT EXISTS contrato_usuarios_rol (
    contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rol_contrato VARCHAR(20) NOT NULL DEFAULT 'rrhh',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (contrato_id, user_id, rol_contrato)
);

CREATE INDEX IF NOT EXISTS idx_contrato_usuarios_rol_user ON contrato_usuarios_rol(user_id);
CREATE INDEX IF NOT EXISTS idx_contrato_usuarios_rol_contrato ON contrato_usuarios_rol(contrato_id);
