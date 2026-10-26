-- 15 — Alertas IA por contrato
-- (copia de modelo_datos/15_alertas_ia.sql; el job de migración monta /schema)
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS alerta_anticipacion_dias INTEGER NOT NULL DEFAULT 30;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS alerta_frecuencia_dias   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS alerta_faltantes_dias    INTEGER NOT NULL DEFAULT 3;
