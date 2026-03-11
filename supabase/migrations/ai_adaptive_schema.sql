-- ==============================================================================
-- Adaptive AI Face Recognition Schema Update
-- ==============================================================================

-- 1. Create the detailed face_embeddings table
CREATE TABLE public.face_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    embedding_vector JSONB NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by student
CREATE INDEX idx_face_embeddings_student_id ON public.face_embeddings(student_id);

-- 2. Create the verification logs table
CREATE TABLE public.face_verification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    similarity_score FLOAT,
    device_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for auditing history over time
CREATE INDEX idx_face_verification_logs_student_id_timestamp ON public.face_verification_logs(student_id, timestamp DESC);

-- 3. Row Level Security (RLS) policies
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_verification_logs ENABLE ROW LEVEL SECURITY;

-- Allow AI service role full access
CREATE POLICY "Service Role Full Access Face Embeddings" 
ON public.face_embeddings 
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service Role Full Access Verification Logs" 
ON public.face_verification_logs 
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow Admins read access to logs
CREATE POLICY "Admins Can View Verification Logs" 
ON public.face_verification_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('SUPER_ADMIN', 'ADMIN')
  )
);
