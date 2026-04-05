import { supabase } from './supabase';

export interface EmployeeIdConfig {
  prefix: string;
  format: 'SEQUENTIAL' | 'YEAR_SEQUENTIAL' | 'DEPT_SEQUENTIAL' | 'CUSTOM';
  separator: string;
  padding: number;
  customPattern?: string;
}

export interface GeneratedEmployeeId {
  employeeId: string;
  sequence: number;
  generatedAt: string;
}

const DEFAULT_CONFIG: EmployeeIdConfig = {
  prefix: 'EMP',
  format: 'SEQUENTIAL',
  separator: '-',
  padding: 4,
};

export function generateEmployeeId(
  config: EmployeeIdConfig = DEFAULT_CONFIG,
  sequence: number = 1,
  metadata?: {
    year?: number;
    departmentCode?: string;
    department?: string;
    name?: string;
  }
): string {
  const parts: string[] = [];
  
  if (config.prefix) {
    parts.push(config.prefix.toUpperCase());
  }

  switch (config.format) {
    case 'YEAR_SEQUENTIAL':
      if (metadata?.year) {
        parts.push(metadata.year.toString().slice(-2));
      }
      break;
    case 'DEPT_SEQUENTIAL':
      if (metadata?.departmentCode) {
        parts.push(metadata.departmentCode.toUpperCase().slice(0, 3));
      }
      break;
  }

  const paddedSeq = sequence.toString().padStart(config.padding, '0');
  parts.push(paddedSeq);

  return parts.join(config.separator);
}

export function parseEmployeeId(
  employeeId: string,
  config: EmployeeIdConfig = DEFAULT_CONFIG
): {
  prefix?: string;
  year?: string;
  deptCode?: string;
  sequence: string;
} | null {
  const parts = employeeId.split(config.separator);
  if (parts.length < 2) return null;

  const result: Record<string, string> = { sequence: parts[parts.length - 1] };

  switch (config.format) {
    case 'YEAR_SEQUENTIAL':
      if (parts.length >= 3) {
        result.prefix = parts[0];
        result.year = parts[1];
      } else {
        result.prefix = parts[0];
      }
      break;
    case 'DEPT_SEQUENTIAL':
      if (parts.length >= 3) {
        result.prefix = parts[0];
        result.deptCode = parts[1];
      } else {
        result.prefix = parts[0];
      }
      break;
    default:
      result.prefix = parts[0];
  }

  return result as ReturnType<typeof parseEmployeeId>;
}

export function validateEmployeeId(
  employeeId: string,
  config: EmployeeIdConfig = DEFAULT_CONFIG
): { valid: boolean; error?: string } {
  if (!employeeId) {
    return { valid: false, error: 'Employee ID is required' };
  }

  if (config.prefix && !employeeId.toUpperCase().startsWith(config.prefix)) {
    return { valid: false, error: `Employee ID must start with ${config.prefix}` };
  }

  const parts = employeeId.split(config.separator);
  const sequencePart = parts[parts.length - 1];
  
  if (!/^\d+$/.test(sequencePart)) {
    return { valid: false, error: 'Employee ID sequence must be numeric' };
  }

  if (sequencePart.length > config.padding) {
    return { valid: false, error: `Sequence number exceeds ${config.padding} digits` };
  }

  return { valid: true };
}

export async function getNextSequence(
  organizationId: string,
  _config: EmployeeIdConfig = DEFAULT_CONFIG
): Promise<number> {
  const { data, error } = await supabase
    .from('employee_id_sequences')
    .select('sequence')
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) {
    return 1;
  }

  return data.sequence + 1;
}

export async function incrementSequence(
  organizationId: string,
  currentSequence: number
): Promise<void> {
  const { error } = await supabase
    .from('employee_id_sequences')
    .upsert({
      organization_id: organizationId,
      sequence: currentSequence + 1,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to increment sequence:', error);
  }
}

export async function generateAndAssignEmployeeId(
  organizationId: string,
  metadata?: {
    year?: number;
    departmentCode?: string;
    department?: string;
    name?: string;
  }
): Promise<GeneratedEmployeeId> {
  const { data } = await supabase
    .from('organizations')
    .select('employee_id_config')
    .eq('id', organizationId)
    .single();

  const config: EmployeeIdConfig = data?.employee_id_config || DEFAULT_CONFIG;
  const sequence = await getNextSequence(organizationId, config);
  const employeeId = generateEmployeeId(config, sequence, metadata);

  await incrementSequence(organizationId, sequence);

  return {
    employeeId,
    sequence,
    generatedAt: new Date().toISOString(),
  };
}

export const PRESET_FORMATS: Record<string, EmployeeIdConfig> = {
  SIMPLE: {
    prefix: 'EMP',
    format: 'SEQUENTIAL',
    separator: '-',
    padding: 4,
  },
  YEAR_BASED: {
    prefix: 'EMP',
    format: 'YEAR_SEQUENTIAL',
    separator: '-',
    padding: 4,
  },
  DEPARTMENT: {
    prefix: 'EMP',
    format: 'DEPT_SEQUENTIAL',
    separator: '-',
    padding: 3,
  },
  GOOGLE: {
    prefix: 'G',
    format: 'SEQUENTIAL',
    separator: '',
    padding: 6,
  },
  MICROSOFT: {
    prefix: 'MS',
    format: 'SEQUENTIAL',
    separator: '',
    padding: 5,
  },
  NUMERIC: {
    prefix: '',
    format: 'SEQUENTIAL',
    separator: '',
    padding: 6,
  },
};

export const DEPARTMENT_CODES: Record<string, string> = {
  Engineering: 'ENG',
  Product: 'PRD',
  Design: 'DES',
  Analytics: 'ANL',
  Sales: 'SLS',
  Marketing: 'MKT',
  HR: 'HR',
  Finance: 'FIN',
  Operations: 'OPS',
  Support: 'SUP',
};

export function getDepartmentCode(department: string): string {
  return DEPARTMENT_CODES[department] || department.slice(0, 3).toUpperCase();
}
