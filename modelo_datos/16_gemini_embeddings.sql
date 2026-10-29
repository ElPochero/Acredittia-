-- ============================================================================
-- ACREDITTIA — 16_gemini_embeddings.sql
-- Migración a Google Gemini: embeddings de 768 dims con índice HNSW.
--
-- Sustituye el modelo nemotron-3-embed-1b de Nvidia (2048 dims) por text-embedding-004
-- de Google Gemini (768 dims). Al tener menos de 2000 dimensiones, se habilita por primera vez
-- un índice aproximado HNSW (vector_cosine_ops) en pgvector.
-- ============================================================================

-- Los vectores de 2048 dimensiones no son compatibles matemáticamente con los de 768 dimensiones.
-- Se limpian los chunks antiguos para ser re-indexados con el modelo de Gemini.
TRUNCATE TABLE documento_chunk;

-- Modificar tipo de columna embedding a 768 dimensiones
ALTER TABLE documento_chunk ALTER COLUMN embedding TYPE vector(768);

-- Índice HNSW para búsqueda coseno ultra-rápida (soportado en pgvector para <= 2000 dims)
CREATE INDEX IF NOT EXISTS ix_chunk_embedding_hnsw
    ON documento_chunk USING hnsw (embedding vector_cosine_ops);
