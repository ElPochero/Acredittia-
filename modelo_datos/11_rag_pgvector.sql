-- ============================================================================
-- ACREDITTIA — 11_rag_pgvector.sql
-- RAG con pgvector: chunks de documentos y requisitos con embeddings.
--
-- - `vector` está en la allow-list de Azure Database for PostgreSQL
--   Flexible Server; en desarrollo local exige la imagen
--   pgvector/pgvector:pg16 (postgres:16 vanilla no trae la extensión).
-- - `documento_chunk` lleva company_id y queda bajo la misma política
--   p_tenant con FORCE que el resto de tablas multi-tenant (ver 04_rls.sql).
-- - Embeddings de 2048 dims: nvidia/nemotron-3-embed-1b (NIM).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documento_chunk (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contrato_id      uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    documento_id     uuid NULL REFERENCES documentos(id) ON DELETE CASCADE,
    ambito           text NULL,
    titulo           text NOT NULL,
    texto            text NOT NULL,
    embedding        vector(2048) NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_chunk_company_contrato
    ON documento_chunk (company_id, contrato_id);
CREATE INDEX IF NOT EXISTS ix_chunk_contrato
    ON documento_chunk (contrato_id);
CREATE INDEX IF NOT EXISTS ix_chunk_documento
    ON documento_chunk (documento_id) WHERE documento_id IS NOT NULL;

-- Búsqueda exacta por distancia coseno (sin índice aproximado a propósito:
-- HNSW no admite más de 2000 dimensiones y los embeddings son de 2048.
-- Con el volumen esperado (miles de chunks por empresa, siempre filtrados
-- por company_id) el scan exacto responde en ms. Vía de mejora futura:
-- columna halfvec(2048) + HNSW halfvec_cosine_ops, ver
-- https://github.com/pgvector/pgvector-python?tab=readme-ov-file#half-precision-indexing).

-- RLS multi-tenant con FORCE, igual que 04_rls.sql §3.
ALTER TABLE documento_chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_chunk FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant ON documento_chunk;
CREATE POLICY p_tenant ON documento_chunk
    FOR ALL
    USING (app_is_admin() OR company_id = app_company_id())
    WITH CHECK (app_is_admin() OR company_id = app_company_id());

-- Grants explícitos para el rol de la app (patrón de 06_migracion_v11.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON documento_chunk TO acredittia_app;

-- ----------------------------------------------------------------------------
-- chat_historial: existía en el ORM y en las BD reales, pero ningún script la
-- creaba (llegó por create_all). Se declara aquí con IF NOT EXISTS para
-- instalaciones frescas y tests, sin tocar las existentes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_historial (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id          uuid NULL REFERENCES users(id) ON DELETE CASCADE,
    contexto         text NOT NULL,
    mensaje_usuario  text NOT NULL,
    respuesta_ia     text NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_chat_historial_contexto ON chat_historial (contexto);
CREATE INDEX IF NOT EXISTS ix_chat_historial_created ON chat_historial (created_at);
CREATE INDEX IF NOT EXISTS ix_chat_historial_company ON chat_historial (company_id);
CREATE INDEX IF NOT EXISTS ix_chat_historial_user ON chat_historial (user_id);
ALTER TABLE chat_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_historial FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant ON chat_historial;
CREATE POLICY p_tenant ON chat_historial
    FOR ALL
    USING (app_is_admin() OR company_id = app_company_id())
    WITH CHECK (app_is_admin() OR company_id = app_company_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_historial TO acredittia_app;

-- ----------------------------------------------------------------------------
-- Índices de soporte faltantes (chequeo 2 de 05_verificacion.sql).
-- No son del RAG: son FK sin índice de tablas 08/09 que el chequeo exige.
-- Se agregan aquí porque es la migración pendiente; son CREATE IF NOT EXISTS
-- idempotentes y no cambian comportamiento, solo evitan scans en borrados.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_auditoria_doc_auditor ON auditoria_documentos (auditor_id);
CREATE INDEX IF NOT EXISTS ix_auditoria_doc_periodo_doc ON auditoria_documentos (periodo_documento_id);
CREATE INDEX IF NOT EXISTS ix_periodo_doc_cargado_por ON periodo_documentos (cargado_por);
CREATE INDEX IF NOT EXISTS ix_periodo_doc_periodo ON periodo_documentos (periodo_id);
CREATE INDEX IF NOT EXISTS ix_periodo_doc_template ON periodo_documentos (requisito_template_id);
CREATE INDEX IF NOT EXISTS ix_periodo_doc_sujeto ON periodo_documentos (sujeto_id);
CREATE INDEX IF NOT EXISTS ix_periodo_req_periodo ON periodo_documentos_requeridos (periodo_id);
CREATE INDEX IF NOT EXISTS ix_periodo_req_template ON periodo_documentos_requeridos (requisito_template_id);
CREATE INDEX IF NOT EXISTS ix_periodos_contrato ON periodos_laborales (contrato_id);
CREATE INDEX IF NOT EXISTS ix_plantilla_reqs_requisito ON plantilla_requisitos (requisito_id);
CREATE INDEX IF NOT EXISTS ix_plantillas_company ON plantillas (company_id);
CREATE INDEX IF NOT EXISTS ix_sujetos_plantilla ON sujetos (plantilla_id);
