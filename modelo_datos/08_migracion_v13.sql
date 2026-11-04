-- IF NOT EXISTS: 01_esquema.sql ya la trae en instalaciones frescas.
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS hereda_plataformas BOOLEAN NOT NULL DEFAULT TRUE;


INSERT INTO app_schema_migrations (version) VALUES (8) ON CONFLICT DO NOTHING;
