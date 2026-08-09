/* BioBridge RAG storage using Supabase's free gte-small embedding model.
   gte-small returns 384-dimensional embeddings. */

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text,
  file_type text,
  content text,
  char_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_documents" ON documents;
CREATE POLICY "select_own_documents" ON documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_documents" ON documents;
CREATE POLICY "insert_own_documents" ON documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_documents" ON documents;
CREATE POLICY "update_own_documents" ON documents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_documents" ON documents;
CREATE POLICY "delete_own_documents" ON documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int DEFAULT 0,
  content text,
  embedding vector(384)
);

-- If the earlier Bolt migration already created vector(768), convert it to
-- the 384 dimensions used by gte-small. Existing embeddings are cleared because
-- a 768-dimensional vector cannot be reused as a 384-dimensional vector.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.document_chunks'::regclass
      AND attname = 'embedding'
      AND atttypmod = 772
  ) THEN
    ALTER TABLE public.document_chunks
      ALTER COLUMN embedding TYPE vector(384) USING NULL;
  END IF;
END $$;

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chunks" ON document_chunks;
CREATE POLICY "select_own_chunks" ON document_chunks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid())
);
DROP POLICY IF EXISTS "insert_own_chunks" ON document_chunks;
CREATE POLICY "insert_own_chunks" ON document_chunks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid())
);
DROP POLICY IF EXISTS "update_own_chunks" ON document_chunks;
CREATE POLICY "update_own_chunks" ON document_chunks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_own_chunks" ON document_chunks;
CREATE POLICY "delete_own_chunks" ON document_chunks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid())
);

DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

DROP FUNCTION IF EXISTS match_chunks(vector, int);

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  INNER JOIN documents d ON d.id = dc.document_id
  WHERE d.user_id = auth.uid()
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION match_chunks(vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_chunks(vector, int) TO authenticated;
