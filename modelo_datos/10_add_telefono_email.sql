ALTER TABLE sujetos
ADD COLUMN telefono text,
ADD COLUMN email text;


INSERT INTO app_schema_migrations (version) VALUES (10) ON CONFLICT DO NOTHING;
