-- =============================================================
-- Multi-Organization Support Migration
-- =============================================================

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'educational')),
  logo TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  website TEXT,
  contact_email TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{
    "allowSelfRegistration": true,
    "requireEmailVerification": true,
    "enforceDomain": true,
    "maxUsers": 1000,
    "features": {
      "faceRecognition": true,
      "blockchain": true,
      "aiAnalytics": true,
      "geofencing": true,
      "pushNotifications": true
    },
    "attendance": {
      "minAttendancePercent": 75,
      "lateThresholdMinutes": 15,
      "autoMarkAbsent": false,
      "workingHoursStart": "09:00",
      "workingHoursEnd": "17:00"
    }
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User-Organization Mapping
CREATE TABLE IF NOT EXISTS user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'HR', 'FACULTY', 'EMPLOYEE', 'STUDENT')),
  department_id UUID,
  class_id UUID,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- 3. Organization Departments (enhanced)
ALTER TABLE departments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. Organization Classes/Teams
ALTER TABLE classes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 5. Organization-Scoped Data
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE notices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 6. Invitations Table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'HR', 'FACULTY', 'EMPLOYEE', 'STUDENT')),
  invited_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS organization_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_orgs_domain ON organizations(domain);
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_audit_org ON organization_audit_logs(organization_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners can update organizations" ON organizations
  FOR UPDATE USING (
    id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role = 'OWNER')
  );

CREATE POLICY "Users can view their organization memberships" ON user_organizations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage members" ON user_organizations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')
    )
  );

-- Function to get user's current organization
CREATE OR REPLACE FUNCTION get_user_organization(p_user_id UUID)
RETURNS organizations AS $$
  SELECT o.* FROM organizations o
  JOIN user_organizations uo ON uo.organization_id = o.id
  WHERE uo.user_id = p_user_id AND uo.is_active = true
  ORDER BY uo.role = 'OWNER' DESC, o.created_at ASC
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check user role in organization
CREATE OR REPLACE FUNCTION check_org_role(p_user_id UUID, p_org_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = p_user_id 
      AND organization_id = p_org_id 
      AND role = ANY(p_roles)
      AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default organization for existing data
INSERT INTO organizations (name, slug, domain, type, is_active)
VALUES ('Anurag Group of Institutions', 'anurag', 'anurag.edu.in', 'educational', true)
ON CONFLICT (domain) DO NOTHING;
