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