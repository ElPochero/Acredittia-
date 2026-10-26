-- 15 — Alertas IA por contrato
--
-- Cada contrato decide con cuántos días de anticipación se avisa un
-- vencimiento, cada cuántos días se reenvía ese recordatorio y cada cuántos se
-- recuerda la documentación faltante. El cron diario lee estos valores, así que
-- la configuración de la pestaña «Alertas IA» no es decorativa.

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS alerta_anticipacion_dias INTEGER NOT NULL DEFAULT 30;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS alerta_frecuencia_dias   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS alerta_faltantes_dias    INTEGER NOT NULL DEFAULT 3;
