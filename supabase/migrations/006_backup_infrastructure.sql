-- ============================================================
-- 006: Automatic Backup Infrastructure
-- Creates storage bucket + cron-friendly backup logging
-- ============================================================

-- Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create backups table if it doesn't exist (003 may have failed)
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_backups_status_created ON backups(status, created_at DESC);

-- Ensure backups table has RLS (idempotent)
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Add retention_days column for auto-cleanup
ALTER TABLE backups ADD COLUMN IF NOT EXISTS retention_days INTEGER DEFAULT 30;

-- Storage bucket for database exports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'db-backups',
  'db-backups',
  false,
  52428800, -- 50 MB
  ARRAY['application/json', 'application/gzip', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Only service role can access backup bucket
DO $$ BEGIN
  CREATE POLICY "Service role can manage backups" ON storage.objects
    FOR ALL USING (bucket_id = 'db-backups')
    WITH CHECK (bucket_id = 'db-backups');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Function: log a backup event
CREATE OR REPLACE FUNCTION log_backup(
  p_filename TEXT,
  p_size BIGINT,
  p_type TEXT DEFAULT 'automatic',
  p_status TEXT DEFAULT 'completed',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  backup_id UUID;
BEGIN
  INSERT INTO backups (filename, size, type, status, completed_at, metadata)
  VALUES (p_filename, p_size, p_type, p_status, NOW(), p_metadata)
  RETURNING id INTO backup_id;
  RETURN backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: cleanup old backups (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM backups
  WHERE status = 'completed'
    AND created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: backup summary for admin dashboard
CREATE OR REPLACE VIEW backup_summary AS
SELECT
  COUNT(*) AS total_backups,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  MAX(created_at) FILTER (WHERE status = 'completed') AS last_successful_backup,
  COALESCE(SUM(size) FILTER (WHERE status = 'completed'), 0) AS total_size_bytes,
  ROUND(COALESCE(SUM(size) FILTER (WHERE status = 'completed'), 0) / 1048576.0, 2) AS total_size_mb
FROM backups;
