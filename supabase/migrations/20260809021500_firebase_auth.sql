/* Move BioBridge ownership from Supabase Auth UUIDs to Firebase Auth UIDs.
   Supabase remains the database/vector backend; Firebase owns login/signup. */

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
ALTER TABLE public.documents ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE public.documents ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_documents" ON public.documents;
DROP POLICY IF EXISTS "insert_own_documents" ON public.documents;
DROP POLICY IF EXISTS "update_own_documents" ON public.documents;
DROP POLICY IF EXISTS "delete_own_documents" ON public.documents;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "insert_own_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "update_own_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "delete_own_chunks" ON public.document_chunks;

DROP FUNCTION IF EXISTS public.match_chunks(vector, int);
DROP FUNCTION IF EXISTS public.match_chunks(vector, int, text);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 10,
  p_user_id text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  filename text,
  chunk_index int,
  content text,
  similarity float,
  source_rank bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dc.id,
    dc.document_id,
    d.filename,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    row_number() OVER (ORDER BY dc.embedding <=> query_embedding) AS source_rank
  FROM public.document_chunks dc
  INNER JOIN public.documents d ON d.id = dc.document_id
  WHERE d.user_id = p_user_id
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_chunks(vector, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, int, text) TO service_role;

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents(user_id);
