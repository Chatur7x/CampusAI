-- ============================================================
-- AISMS - Add backups table + RLS
-- ============================================================

-- Table: backups (matches legacy Prisma model)
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT NOT NULL, -- automatic | manual
  status TEXT NOT NULL, -- completed | failed | in_progress
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Helpful index for status queries
CREATE INDEX IF NOT EXISTS idx_backups_status_created ON backups(status, created_at DESC);

-- Enable RLS
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write backups
CREATE POLICY "Admins can view backups" ON backups
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage backups" ON backups
  FOR ALL USING (is_admin(auth.uid()));
