-- =============================================================
-- Employee ID Sequences Table
-- =============================================================

CREATE TABLE IF NOT EXISTS employee_id_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_id_sequences_org ON employee_id_sequences(organization_id);

-- =============================================================
-- Add employee_id_config column to organizations
-- =============================================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS employee_id_config JSONB DEFAULT '{
  "prefix": "EMP",
  "format": "SEQUENTIAL",
  "separator": "-",
  "padding": 4
}'::JSONB;

-- =============================================================
-- Add employee_id column to profiles/employees
-- =============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;

-- =============================================================
-- Initialize sequences for existing organizations
-- =============================================================

INSERT INTO employee_id_sequences (organization_id, sequence)
SELECT id, 1
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM employee_id_sequences WHERE organization_id = organizations.id
);

-- =============================================================
-- Function to auto-generate employee ID on insert
-- =============================================================

CREATE OR REPLACE FUNCTION generate_employee_id(org_id UUID, emp_data JSONB DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  config JSONB;
  prefix TEXT;
  format_type TEXT;
  separator TEXT;
  padding INT;
  seq_num INT;
  new_id TEXT;
BEGIN
  -- Get config from organization
  SELECT employee_id_config INTO config
  FROM organizations WHERE id = org_id;
  
  IF config IS NULL THEN
    config := '{"prefix": "EMP", "format": "SEQUENTIAL", "separator": "-", "padding": 4}'::JSONB;
  END IF;
  
  prefix := COALESCE(config->>'prefix', 'EMP');
  format_type := COALESCE(config->>'format', 'SEQUENTIAL');
  separator := COALESCE(config->>'separator', '-');
  padding := COALESCE((config->>'padding')::INT, 4);
  
  -- Get and increment sequence
  UPDATE employee_id_sequences 
  SET sequence = sequence + 1, updated_at = NOW()
  WHERE organization_id = org_id
  RETURNING sequence INTO seq_num;
  
  IF seq_num IS NULL THEN
    INSERT INTO employee_id_sequences (organization_id, sequence)
    VALUES (org_id, 1)
    RETURNING sequence INTO seq_num;
  END IF;
  
  -- Generate ID based on format
  CASE format_type
    WHEN 'YEAR_SEQUENTIAL' THEN
      new_id := prefix || separator || TO_CHAR(NOW(), 'YY') || separator || LPAD(seq_num::TEXT, padding, '0');
    WHEN 'DEPT_SEQUENTIAL' THEN
      new_id := prefix || separator || COALESCE(emp_data->>'dept_code', 'GEN') || separator || LPAD(seq_num::TEXT, padding, '0');
    ELSE
      new_id := prefix || separator || LPAD(seq_num::TEXT, padding, '0');
  END CASE;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- Trigger to auto-generate employee_id on employee insert
-- =============================================================

CREATE OR REPLACE FUNCTION set_employee_id_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.employee_id := generate_employee_id(NEW.organization_id, jsonb_build_object('dept_code', NEW.department_code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Uncomment below if you want auto-generation on insert
-- DROP TRIGGER IF EXISTS trg_set_employee_id ON employees;
-- CREATE TRIGGER trg_set_employee_id
--   BEFORE INSERT ON employees
--   FOR EACH ROW
--   EXECUTE FUNCTION set_employee_id_trigger();
