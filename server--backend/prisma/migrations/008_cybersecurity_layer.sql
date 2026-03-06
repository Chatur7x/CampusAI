-- =====================================================
-- MIGRATION 008: CYBERSECURITY LAYER
-- Token blacklist, device trust, security events,
-- login history, geo-verification, MFA enhancements
-- =====================================================

-- ==================== TOKEN BLACKLIST ====================
-- Revoked JWTs are stored here; auth middleware checks on every request
CREATE TABLE IF NOT EXISTS token_blacklist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,  -- SHA-256 of JWT (never store raw token)
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT 'logout',  -- logout, password_change, admin_revoke, suspicious
  expires_at  TIMESTAMPTZ NOT NULL,            -- auto-cleanup after JWT expiry
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- ==================== DEVICE TRUST ====================
-- Fingerprints of known/trusted devices per user
CREATE TABLE IF NOT EXISTS trusted_devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash      TEXT NOT NULL,          -- SHA-256(browser+GPU+screen+timezone+â€¦)
  device_name      TEXT,                    -- "Chrome on Windows", auto-generated
  browser          TEXT,
  os               TEXT,
  ip_address       TEXT,
  last_used_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_trusted       BOOLEAN NOT NULL DEFAULT false,
  trust_expires_at TIMESTAMPTZ,            -- optional TTL for trust
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_hash)
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);

-- ==================== LOGIN HISTORY ====================
CREATE TABLE IF NOT EXISTS login_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address   TEXT,
  user_agent   TEXT,
  device_hash  TEXT,
  location     JSONB,                -- {lat, lng, city, country}
  status       TEXT NOT NULL,        -- success, failed, locked, mfa_required
  failure_reason TEXT,               -- wrong_password, expired_token, etc.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address);

-- ==================== SECURITY EVENTS ====================
-- Central security event log for incident response
CREATE TABLE IF NOT EXISTS security_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,        -- login_anomaly, geo_spoof, device_mismatch, brute_force, api_abuse, data_tamper
  severity     TEXT NOT NULL DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH, CRITICAL
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  description  TEXT NOT NULL,
  metadata     JSONB,               -- arbitrary event-specific data
  resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved ON security_events(resolved) WHERE resolved = false;

-- ==================== GEO VERIFICATION LOG ====================
CREATE TABLE IF NOT EXISTS geo_verifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude         DOUBLE PRECISION NOT NULL,
  longitude        DOUBLE PRECISION NOT NULL,
  accuracy         DOUBLE PRECISION,
  campus_distance  DOUBLE PRECISION,  -- meters from campus center
  is_within_campus BOOLEAN NOT NULL,
  spoof_detected   BOOLEAN NOT NULL DEFAULT false,
  spoof_reason     TEXT,
  attendance_id    UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_geo_verifications_user ON geo_verifications(user_id);

-- ==================== MFA BACKUP CODES ====================
-- Separate table for better management
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,         -- bcrypt of 8-char code
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_user ON mfa_backup_codes(user_id);

-- ==================== API REQUEST LOG ====================
-- For rate-limit analytics and threat detection
CREATE TABLE IF NOT EXISTS api_request_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,
  status_code  INT,
  ip_address   TEXT,
  user_agent   TEXT,
  response_ms  INT,               -- response time in ms
  flagged      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_request_user ON api_request_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_request_path ON api_request_log(path);
CREATE INDEX IF NOT EXISTS idx_api_request_flagged ON api_request_log(flagged) WHERE flagged = true;
-- Partition-friendly index on creation time
CREATE INDEX IF NOT EXISTS idx_api_request_created ON api_request_log(created_at);

-- ==================== RLS POLICIES ====================
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;

-- Token blacklist: backend service role only (no direct user access)
CREATE POLICY "service_only_token_blacklist" ON token_blacklist
  FOR ALL USING (auth.role() = 'service_role');

-- Trusted devices: users can view/manage their own devices
CREATE POLICY "users_own_devices" ON trusted_devices
  FOR ALL USING (auth.uid() = user_id);

-- Login history: users see their own, admins see all
CREATE POLICY "users_own_login_history" ON login_history
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN'))
  );
CREATE POLICY "service_insert_login_history" ON login_history
  FOR INSERT WITH CHECK (true);

-- Security events: admin-only read, service-role insert
CREATE POLICY "admin_read_security_events" ON security_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN'))
  );
CREATE POLICY "service_insert_security_events" ON security_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_update_security_events" ON security_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN'))
  );

-- Geo verifications: users see own, admins see all
CREATE POLICY "users_own_geo" ON geo_verifications
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN'))
  );
CREATE POLICY "service_insert_geo" ON geo_verifications
  FOR INSERT WITH CHECK (true);

-- MFA backup codes: users own only
CREATE POLICY "users_own_mfa_codes" ON mfa_backup_codes
  FOR ALL USING (auth.uid() = user_id);

-- API request log: admin-only read
CREATE POLICY "admin_read_api_log" ON api_request_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN'))
  );
CREATE POLICY "service_insert_api_log" ON api_request_log
  FOR INSERT WITH CHECK (true);

-- ==================== CLEANUP FUNCTION ====================
-- Automatically purge expired blacklisted tokens (run via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM token_blacklist WHERE expires_at < now();
  DELETE FROM api_request_log WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== SECURITY SUMMARY VIEW ====================
CREATE OR REPLACE VIEW security_dashboard_stats AS
SELECT
  (SELECT count(*) FROM security_events WHERE resolved = false) AS open_events,
  (SELECT count(*) FROM security_events WHERE resolved = false AND severity = 'CRITICAL') AS critical_events,
  (SELECT count(*) FROM login_history WHERE status = 'failed' AND created_at > now() - INTERVAL '24 hours') AS failed_logins_24h,
  (SELECT count(*) FROM login_history WHERE status = 'success' AND created_at > now() - INTERVAL '24 hours') AS successful_logins_24h,
  (SELECT count(*) FROM token_blacklist WHERE expires_at > now()) AS active_blacklisted_tokens,
  (SELECT count(*) FROM trusted_devices WHERE is_trusted = true) AS trusted_device_count,
  (SELECT count(*) FROM geo_verifications WHERE spoof_detected = true AND created_at > now() - INTERVAL '7 days') AS spoof_detections_7d,
  (SELECT count(*) FROM api_request_log WHERE flagged = true AND created_at > now() - INTERVAL '24 hours') AS flagged_requests_24h;
