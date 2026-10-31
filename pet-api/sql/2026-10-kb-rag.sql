-- 寵物健康知識庫（RAG）資料表
-- 已於 2026-10-30 套用到 Neon（project: pet-app, branch: production）。
-- 保留在 repo 方便重建環境；全部使用 IF NOT EXISTS，可重複執行。

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_documents (
  id                   SERIAL PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  species              TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'both')),
  category             TEXT NOT NULL,
  related_event_types  TEXT[] NOT NULL DEFAULT '{}',
  severity_hint        TEXT,
  source_name          TEXT NOT NULL,
  source_url           TEXT NOT NULL,
  retrieved_on         DATE,
  review_status        TEXT NOT NULL DEFAULT 'draft_needs_review',
  note                 TEXT,
  content              TEXT NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id               SERIAL PRIMARY KEY,
  document_id      INTEGER NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index      INTEGER NOT NULL,
  content          TEXT NOT NULL,
  embedding        vector(768),
  embedding_model  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_species  ON kb_documents (species);
CREATE INDEX IF NOT EXISTS idx_kb_documents_category ON kb_documents (category);
CREATE INDEX IF NOT EXISTS idx_kb_documents_events   ON kb_documents USING GIN (related_event_types);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document    ON kb_chunks (document_id);

-- 切片數量不多（約 100～200 個）時，精確掃描就夠快且召回率 100%。
-- 超過幾千個切片再考慮加 HNSW：
-- CREATE INDEX idx_kb_chunks_embedding ON kb_chunks USING hnsw (embedding vector_cosine_ops);
