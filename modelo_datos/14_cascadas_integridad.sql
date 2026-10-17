-- ============================================================================
-- 14. Cascadas de eliminación para contratos, sujetos y documentos (ON DELETE CASCADE)
-- ============================================================================
-- Asegura que al eliminar un contrato o sujeto se borren en cascada sus tablas
-- hijas según lo especificado en 01_esquema.sql, evitando errores de clave foránea.
-- ============================================================================

-- 1. Cascadas desde contratos
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_contrato_id_fkey,
  ADD CONSTRAINT documentos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

ALTER TABLE sujetos DROP CONSTRAINT IF EXISTS sujetos_contrato_id_fkey,
  ADD CONSTRAINT sujetos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

ALTER TABLE contrato_requisitos DROP CONSTRAINT IF EXISTS contrato_requisitos_contrato_id_fkey,
  ADD CONSTRAINT contrato_requisitos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

ALTER TABLE contrato_plataformas DROP CONSTRAINT IF EXISTS contrato_plataformas_contrato_id_fkey,
  ADD CONSTRAINT contrato_plataformas_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

ALTER TABLE contrato_plantilla_overrides DROP CONSTRAINT IF EXISTS contrato_plantilla_overrides_contrato_id_fkey,
  ADD CONSTRAINT contrato_plantilla_overrides_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

ALTER TABLE cumplimiento_snapshots DROP CONSTRAINT IF EXISTS cumplimiento_snapshots_contrato_id_fkey,
  ADD CONSTRAINT cumplimiento_snapshots_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_contrato_id_fkey,
  ADD CONSTRAINT alertas_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

ALTER TABLE periodos_laborales DROP CONSTRAINT IF EXISTS periodos_laborales_contrato_id_fkey,
  ADD CONSTRAINT periodos_laborales_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

-- 2. Cascadas desde sujetos
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_sujeto_id_fkey,
  ADD CONSTRAINT documentos_sujeto_id_fkey FOREIGN KEY (sujeto_id) REFERENCES sujetos(id) ON DELETE CASCADE;

ALTER TABLE licencias_internas DROP CONSTRAINT IF EXISTS licencias_internas_sujeto_id_fkey,
  ADD CONSTRAINT licencias_internas_sujeto_id_fkey FOREIGN KEY (sujeto_id) REFERENCES sujetos(id) ON DELETE CASCADE;

ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_sujeto_id_fkey,
  ADD CONSTRAINT alertas_sujeto_id_fkey FOREIGN KEY (sujeto_id) REFERENCES sujetos(id) ON DELETE CASCADE;

ALTER TABLE periodo_documentos DROP CONSTRAINT IF EXISTS periodo_documentos_sujeto_id_fkey,
  ADD CONSTRAINT periodo_documentos_sujeto_id_fkey FOREIGN KEY (sujeto_id) REFERENCES sujetos(id) ON DELETE CASCADE;

-- 3. Cascadas desde documentos
ALTER TABLE documento_archivos DROP CONSTRAINT IF EXISTS documento_archivos_documento_id_fkey,
  ADD CONSTRAINT documento_archivos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE;

ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_documento_id_fkey,
  ADD CONSTRAINT alertas_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE;

ALTER TABLE eventos_calendario DROP CONSTRAINT IF EXISTS eventos_calendario_documento_id_fkey,
  ADD CONSTRAINT eventos_calendario_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE;
