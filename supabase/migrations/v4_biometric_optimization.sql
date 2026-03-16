-- ==============================================================================
-- Bio-Net v4: Biometric Database Optimization (pgvector + HNSW)
-- ==============================================================================

-- 1. Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add high-performance vector column to face_embeddings
-- Note: ArcFace buffalo_l produces 512-dimension vectors
ALTER TABLE public.face_embeddings 
ADD COLUMN IF NOT EXISTS embedding_v4 vector(512);

-- 3. Create HNSW (Hierarchical Navigable Small Worlds) index
-- HNSW is much faster than IVF for dynamic biometric databases
CREATE INDEX IF NOT EXISTS idx_face_embeddings_hnsw ON public.face_embeddings 
USING hnsw (embedding_v4 vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. Create Advanced Biometric Search Function (Stored Procedure)
-- This performs the 1:N matching entirely in the database layer.
CREATE OR REPLACE FUNCTION public.match_face_v4(
    probe_embedding vector(512),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    student_id UUID,
    similarity FLOAT,
    enrollment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH similarity_base AS (
        SELECT 
            fe.student_id,
            1 - (fe.embedding_v4 <=> probe_embedding) AS sim -- <=> is cosine distance
        FROM public.face_embeddings fe
    ),
    best_matches AS (
        SELECT 
            sb.student_id,
            MAX(sb.sim) as max_sim,
            COUNT(*) as versions
        FROM similarity_base sb
        WHERE sb.sim >= match_threshold
        GROUP BY sb.student_id
    )
    SELECT 
        bm.student_id,
        bm.max_sim,
        bm.versions
    FROM best_matches bm
    ORDER BY bm.max_sim DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add Advanced Security Audit Trigger
-- Automatically flag high-risk security events in the DB layer
CREATE OR REPLACE FUNCTION public.audit_biometric_security()
RETURNS TRIGGER AS $$
BEGIN
    -- If similarity is extremely low but match was forced (or if there are other flags)
    IF NEW.similarity_score < 0.4 THEN
        INSERT INTO public.security_events (event_type, severity, description, user_id, metadata)
        VALUES (
            'BIOMETRIC_FAILURE',
            'HIGH',
            'Face verification failed with extremely low similarity score: ' || NEW.similarity_score,
            (SELECT user_id FROM students WHERE id = NEW.student_id),
            jsonb_build_object('log_id', NEW.id, 'score', NEW.similarity_score)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_biometric_security_audit
AFTER INSERT ON public.face_verification_logs
FOR EACH ROW EXECUTE FUNCTION public.audit_biometric_security();
