-- Migración para añadir archivo_ejemplo a requisito_templates
-- IF NOT EXISTS: 01_esquema.sql ya la trae en instalaciones frescas.
ALTER TABLE requisito_templates ADD COLUMN IF NOT EXISTS archivo_ejemplo text;


INSERT INTO app_schema_migrations (version) VALUES (7) ON CONFLICT DO NOTHING;
