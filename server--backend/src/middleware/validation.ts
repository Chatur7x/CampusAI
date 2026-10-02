import { Request, Response, NextFunction } from 'express';

interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'date' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export const validate = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: { field: string; message: string }[] = [];
    const data = req.body;

    for (const rule of rules) {
      const value = data[rule.field];

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: rule.field, message: `${rule.field} is required` });
        continue;
      }

      // Skip further validation if value is not provided and not required
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Type validation
      if (rule.type) {
        let valid = true;
        switch (rule.type) {
          case 'string':
            valid = typeof value === 'string';
            break;
          case 'number':
            valid = typeof value === 'number' && !isNaN(value);
            break;
          case 'boolean':
            valid = typeof value === 'boolean';
            break;
          case 'email':
            valid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            break;
          case 'date':
            valid = !isNaN(Date.parse(value));
            break;
          case 'array':
            valid = Array.isArray(value);
            break;
        }
        if (!valid) {
          errors.push({ field: rule.field, message: `${rule.field} must be a valid ${rule.type}` });
          continue;
        }
      }

      // String length validation
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push({ field: rule.field, message: `${rule.field} must be at least ${rule.minLength} characters` });
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push({ field: rule.field, message: `${rule.field} must be at most ${rule.maxLength} characters` });
        }
      }

      // Number range validation
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push({ field: rule.field, message: `${rule.field} must be at least ${rule.min}` });
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push({ field: rule.field, message: `${rule.field} must be at most ${rule.max}` });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push({ field: rule.field, message: `${rule.field} format is invalid` });
      }

      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
          errors.push({ field: rule.field, message: typeof result === 'string' ? result : `${rule.field} is invalid` });
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    next();
  };
};

// Common validation schemas
export const loginValidation = validate([
  { field: 'email', required: true, type: 'email' },
  { field: 'password', required: true, type: 'string', minLength: 6 },
]);

export const registerValidation = validate([
  { field: 'email', required: true, type: 'email' },
  { field: 'password', required: true, type: 'string', minLength: 8 },
  { field: 'firstName', required: true, type: 'string', minLength: 2 },
  { field: 'lastName', required: true, type: 'string', minLength: 2 },
  { field: 'role', required: true, type: 'string' },
]);

// Leave approval status must be an explicit enum value. Without this a caller
// could PUT { status: "ANYTHING" } and write an arbitrary string into the
// status column.
export const leaveDecisionValidation = validate([
  {
    field: 'status',
    required: true,
    type: 'string',
    custom: (v) => (['APPROVED', 'REJECTED'] as const).includes(v as never) || 'status must be APPROVED or REJECTED',
  },
  { field: 'comments', type: 'string', maxLength: 1000 },
]);

export const attendanceValidation = validate([
  { field: 'studentId', required: true, type: 'string' },
  { field: 'status', required: true, type: 'string' },
  { field: 'method', required: true, type: 'string' },
]);

export const leaveValidation = validate([
  { field: 'startDate', required: true, type: 'date' },
  { field: 'endDate', required: true, type: 'date' },
  { field: 'reason', required: true, type: 'string', minLength: 5, maxLength: 500 },
  { field: 'type', required: true, type: 'string' },
]);

export const noticeValidation = validate([
  { field: 'title', required: true, type: 'string', minLength: 3, maxLength: 200 },
  { field: 'content', required: true, type: 'string', minLength: 10 },
  { field: 'priority', type: 'string' },
]);

// ── Administrative writes ───────────────────────────────────────────────
// These were reachable with an arbitrary body: role, email and the boolean
// flags all flowed straight into Prisma. Each is now bounded and, where the
// value is an enum, pinned to a fixed set.

const ROLE = ['ADMIN', 'SUPER_ADMIN', 'FACULTY', 'CLASS_INCHARGE', 'STUDENT', 'COMPANY'];

export const createUserValidation = validate([
  { field: 'email', required: true, type: 'email' },
  { field: 'password', required: true, type: 'string', minLength: 8, maxLength: 128 },
  { field: 'first_name', required: true, type: 'string', minLength: 1, maxLength: 100 },
  { field: 'last_name', required: true, type: 'string', minLength: 1, maxLength: 100 },
  {
    field: 'role',
    required: true,
    type: 'string',
    custom: (v) => ROLE.includes(v) || `role must be one of: ${ROLE.join(', ')}`,
  },
]);

export const updateUserValidation = validate([
  { field: 'first_name', type: 'string', minLength: 1, maxLength: 100 },
  { field: 'last_name', type: 'string', minLength: 1, maxLength: 100 },
  { field: 'is_active', type: 'boolean' },
  {
    field: 'role',
    type: 'string',
    custom: (v) => ROLE.includes(v) || `role must be one of: ${ROLE.join(', ')}`,
  },
]);

export const departmentValidation = validate([
  { field: 'name', required: true, type: 'string', minLength: 2, maxLength: 120 },
  { field: 'code', type: 'string', maxLength: 20 },
  { field: 'description', type: 'string', maxLength: 1000 },
  { field: 'hod_id', type: 'string', maxLength: 128 },
]);

export const departmentUpdateValidation = validate([
  { field: 'name', type: 'string', minLength: 2, maxLength: 120 },
  { field: 'description', type: 'string', maxLength: 1000 },
  { field: 'hod_id', type: 'string', maxLength: 128 },
]);

export const courseValidation = validate([
  { field: 'name', required: true, type: 'string', minLength: 2, maxLength: 150 },
  { field: 'code', type: 'string', maxLength: 20 },
  { field: 'credits', type: 'number', min: 0, max: 30 },
  { field: 'semester', type: 'number', min: 1, max: 12 },
  { field: 'department_id', type: 'string', maxLength: 128 },
  { field: 'description', type: 'string', maxLength: 1000 },
]);

export const classValidation = validate([
  { field: 'name', required: true, type: 'string', minLength: 1, maxLength: 100 },
  { field: 'section', type: 'string', maxLength: 20 },
  { field: 'department_id', type: 'string', maxLength: 128 },
  { field: 'course_id', type: 'string', maxLength: 128 },
  { field: 'incharge_id', type: 'string', maxLength: 128 },
  { field: 'room_number', type: 'string', maxLength: 50 },
  { field: 'capacity', type: 'number', min: 0, max: 1000 },
  { field: 'academic_year', type: 'string', maxLength: 20 },
]);

export const settingValidation = validate([
  { field: 'value', required: true, type: 'string', maxLength: 5000 },
]);

// ── Timetable ───────────────────────────────────────────────────────────

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const timetableValidation = validate([
  { field: 'classId', required: true, type: 'string', maxLength: 128 },
  { field: 'subjectId', required: true, type: 'string', maxLength: 128 },
  { field: 'facultyId', type: 'string', maxLength: 128 },
  {
    field: 'dayOfWeek',
    required: true,
    type: 'number',
    min: 0,
    max: 6,
    custom: (v) => Number.isInteger(v) || 'dayOfWeek must be a whole number',
  },
  { field: 'startTime', required: true, type: 'string', pattern: TIME_PATTERN },
  { field: 'endTime', required: true, type: 'string', pattern: TIME_PATTERN },
  { field: 'roomNumber', type: 'string', maxLength: 50 },
]);

export const timetableBulkValidation = validate([
  { field: 'entries', required: true, type: 'array' },
  {
    field: 'entries',
    custom: (v) => Array.isArray(v) && v.length > 0 && v.length <= 200
      || 'entries must be a non-empty array of at most 200 items',
  },
]);

// ── Bulk attendance correction ──────────────────────────────────────────

export const bulkCorrectionValidation = validate([
  { field: 'corrections', required: true, type: 'array' },
  {
    field: 'corrections',
    custom: (v) => Array.isArray(v) && v.length > 0 && v.length <= 1000
      || 'corrections must be a non-empty array of at most 1000 items',
  },
]);

// ── Chat ────────────────────────────────────────────────────────────────

export const chatMessageValidation = validate([
  { field: 'receiverId', type: 'string', maxLength: 128 },
  { field: 'conversationId', type: 'string', maxLength: 128 },
  { field: 'content', required: true, type: 'string', minLength: 1, maxLength: 5000 },
  { field: 'replyToId', type: 'string', maxLength: 128 },
  {
    field: 'messageType',
    type: 'string',
    custom: (v) => ['TEXT', 'IMAGE', 'FILE', 'SYSTEM'].includes(v) || 'invalid messageType',
  },
  {
    field: 'attachments',
    custom: (v) => Array.isArray(v) && v.length <= 10 || 'at most 10 attachments',
  },
]);

// ── Security self-service ───────────────────────────────────────────────

export const deviceTrustValidation = validate([
  { field: 'trusted', required: true, type: 'boolean' },
  { field: 'ttlDays', type: 'number', min: 1, max: 365 },
]);

export const revokeAllValidation = validate([
  { field: 'keepCurrent', type: 'boolean' },
]);

export const attendanceStatusValidation = validate([
  { field: 'status', required: true, type: 'string' },
  {
    field: 'status',
    custom: (v) => ['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE', 'EXCUSED'].includes(v)
      || 'status must be PRESENT, ABSENT, LATE, ON_LEAVE or EXCUSED',
  },
  { field: 'justification', type: 'string', maxLength: 500 },
]);