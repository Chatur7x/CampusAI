import { Response } from 'express';
import { AuthenticatedRequest, BulkUploadResult } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';
import { hashPassword } from '../utils/bcrypt';
import csvParser from 'csv-parser';
import xlsx from 'xlsx';
import fs from 'fs';
import crypto from 'crypto';

const generateSecurePassword = (): string => crypto.randomBytes(12).toString('base64url');

// ==================== CSV UPLOAD ====================
export const uploadStudentsCSV = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const results: BulkUploadResult = { success: 0, failed: 0, errors: [] };
    const filePath = req.file.path;
    const students: any[] = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => students.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      try {
        if (!row.email || !row.first_name || !row.last_name || !row.enrollment_id) {
          results.failed++;
          results.errors.push({ row: i + 1, message: 'Missing required fields (email, first_name, last_name, enrollment_id)' });
          continue;
        }

        // Email lives on profiles
        const existingProfile = await prisma.profile.findUnique({ where: { email: row.email } });
        if (existingProfile) {
          results.failed++;
          results.errors.push({ row: i + 1, message: `Email ${row.email} already exists` });
          continue;
        }

        const existingStudent = await prisma.student.findUnique({ where: { enrollment_id: row.enrollment_id } });
        if (existingStudent) {
          results.failed++;
          results.errors.push({ row: i + 1, message: `Enrollment ID ${row.enrollment_id} already exists` });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const user = await tx.users.create({
            data: {
              id: crypto.randomUUID(),
              email: row.email,
              encrypted_password: await hashPassword(row.password || generateSecurePassword()),
              email_confirmed_at: new Date(),
            },
          });

          await tx.profile.create({
            data: {
              user_id: user.id,
              email: row.email,
              first_name: row.first_name,
              last_name: row.last_name,
              phone: row.phone || null,
              role: 'STUDENT',
            },
          });

          await tx.student.create({
            data: {
              user_id: user.id,
              enrollment_id: row.enrollment_id,
              department_id: row.department_id || '',
              class_id: row.class_id || '',
              batch_year: parseInt(row.batch_year) || new Date().getFullYear(),
              semester: parseInt(row.semester) || 1,
              guardian_name: row.guardian_name || null,
              guardian_phone: row.guardian_phone || null,
              guardian_email: row.guardian_email || null,
            },
          });
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ row: i + 1, message: (error as Error).message });
      }
    }

    fs.unlinkSync(filePath);

    await logAction({
      userId: req.user.id,
      action: 'BULK_UPLOAD_STUDENTS',
      entityType: 'student',
      newValue: { success: results.success, failed: results.failed },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: `Processed ${students.length} records`, data: results });
  } catch (error) {
    console.error('Upload students CSV error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const uploadFacultyCSV = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const results: BulkUploadResult = { success: 0, failed: 0, errors: [] };
    const filePath = req.file.path;
    const faculty: any[] = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => faculty.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    for (let i = 0; i < faculty.length; i++) {
      const row = faculty[i];
      try {
        if (!row.email || !row.first_name || !row.last_name || !row.employee_id) {
          results.failed++;
          results.errors.push({ row: i + 1, message: 'Missing required fields' });
          continue;
        }

        const existingProfile = await prisma.profile.findUnique({ where: { email: row.email } });
        if (existingProfile) {
          results.failed++;
          results.errors.push({ row: i + 1, message: `Email ${row.email} already exists` });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const user = await tx.users.create({
            data: {
              id: crypto.randomUUID(),
              email: row.email,
              encrypted_password: await hashPassword(row.password || generateSecurePassword()),
              email_confirmed_at: new Date(),
            },
          });

          await tx.profile.create({
            data: {
              user_id: user.id,
              email: row.email,
              first_name: row.first_name,
              last_name: row.last_name,
              phone: row.phone || null,
              role: 'FACULTY',
            },
          });

          await tx.faculty.create({
            data: {
              user_id: user.id,
              employee_id: row.employee_id,
              designation: row.designation || 'Assistant Professor',
              department_id: row.department_id || '',
              joining_date: row.joining_date ? new Date(row.joining_date) : new Date(),
              specialization: row.specialization || null,
            },
          });
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ row: i + 1, message: (error as Error).message });
      }
    }

    fs.unlinkSync(filePath);

    await logAction({
      userId: req.user.id,
      action: 'BULK_UPLOAD_FACULTY',
      entityType: 'faculty',
      newValue: { success: results.success, failed: results.failed },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: `Processed ${faculty.length} records`, data: results });
  } catch (error) {
    console.error('Upload faculty CSV error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== EXPORT OPERATIONS ====================
export const exportStudents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { format } = req.query;

    const students = await prisma.student.findMany({
      include: {
        users: { include: { profiles: true } },
        departments: true,
        classes: true,
      },
    });

    const data = students.map((s) => ({
      enrollment_id: s.enrollment_id,
      email: s.users.profiles?.email,
      first_name: s.users.profiles?.first_name,
      last_name: s.users.profiles?.last_name,
      phone: s.users.profiles?.phone,
      department: s.departments?.name,
      class: s.classes?.name,
      batch_year: s.batch_year,
      semester: s.semester,
      face_registered: s.face_registered,
      guardian_name: s.guardian_name,
      guardian_phone: s.guardian_phone,
    }));

    if (format === 'csv') {
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
      res.send(csv);
      return;
    }

    if (format === 'excel') {
      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Students');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
      res.send(buffer);
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Export students error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const exportAttendance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId, startDate, endDate, format } = req.query;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'FACULTY')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const where: any = {};
    if (classId) where.students = { class_id: classId as string };
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        students: {
          include: {
            users: { include: { profiles: true } },
            classes: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const data = attendance.map((a) => ({
      date: a.date.toISOString().split('T')[0],
      enrollment_id: a.students.enrollment_id,
      student_name: `${a.students.users.profiles?.first_name} ${a.students.users.profiles?.last_name}`,
      class: a.students.classes?.name,
      status: a.status,
      method: a.method,
      confidence_score: a.confidence_score,
      blockchain_hash: a.blockchain_hash,
    }));

    if (format === 'csv') {
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
      res.send(csv);
      return;
    }

    if (format === 'excel') {
      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Attendance');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');
      res.send(buffer);
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== BULK ATTENDANCE CORRECTION ====================
export const bulkAttendanceCorrection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { corrections } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const results = [];
    const errors = [];

    for (const correction of corrections) {
      try {
        const { studentId, date, status, justification } = correction;

        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        const existing = await prisma.attendance.findUnique({
          where: {
            student_id_date_subject_id: {
              student_id: studentId,
              date: attendanceDate,
              subject_id: null as any,
            },
          },
        });

        const updated = await prisma.attendance.update({
          where: {
            student_id_date_subject_id: {
              student_id: studentId,
              date: attendanceDate,
              subject_id: null as any,
            },
          },
          data: {
            status,
            verified_by: req.user.id,
            justification: justification || 'Bulk correction',
          },
        });

        results.push({ studentId, date, oldStatus: existing?.status, newStatus: status });
      } catch (error) {
        errors.push({ correction, error: (error as Error).message });
      }
    }

    await logAction({
      userId: req.user.id,
      action: 'BULK_ATTENDANCE_CORRECTION',
      entityType: 'attendance',
      newValue: { count: results.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Corrected ${results.length} attendance records`,
      data: { results, errors },
    });
  } catch (error) {
    console.error('Bulk attendance correction error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== HELPER FUNCTIONS ====================
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
