import { Response } from 'express';
import { AuthenticatedRequest, BulkUploadResult } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';
import { hashPassword } from '../utils/bcrypt';
import csvParser from 'csv-parser';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

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

    const results: BulkUploadResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const filePath = req.file.path;
    const students: any[] = [];

    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => students.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      try {
        // Validate required fields
        if (!row.email || !row.firstName || !row.lastName || !row.enrollmentId) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            message: 'Missing required fields (email, firstName, lastName, enrollmentId)',
          });
          continue;
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
          where: { email: row.email },
        });

        if (existingUser) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            message: `Email ${row.email} already exists`,
          });
          continue;
        }

        // Check if enrollment ID exists
        const existingStudent = await prisma.student.findUnique({
          where: { enrollmentId: row.enrollmentId },
        });

        if (existingStudent) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            message: `Enrollment ID ${row.enrollmentId} already exists`,
          });
          continue;
        }

        // Create user and student
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: row.email,
              password: await hashPassword(row.password || 'Student@123'),
              role: 'STUDENT',
            },
          });

          await tx.profile.create({
            data: {
              userId: user.id,
              firstName: row.firstName,
              lastName: row.lastName,
              phone: row.phone || null,
            },
          });

          await tx.student.create({
            data: {
              userId: user.id,
              enrollmentId: row.enrollmentId,
              departmentId: row.departmentId || '',
              classId: row.classId || '',
              batchYear: parseInt(row.batchYear) || new Date().getFullYear(),
              semester: parseInt(row.semester) || 1,
              guardianName: row.guardianName || null,
              guardianPhone: row.guardianPhone || null,
              guardianEmail: row.guardianEmail || null,
            },
          });
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          message: (error as Error).message,
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    await logAction({
      userId: req.user.id,
      action: 'BULK_UPLOAD_STUDENTS',
      entityType: 'student',
      newValue: { success: results.success, failed: results.failed },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Processed ${students.length} records`,
      data: results,
    });
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

    const results: BulkUploadResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

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
        if (!row.email || !row.firstName || !row.lastName || !row.employeeId) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            message: 'Missing required fields',
          });
          continue;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email: row.email },
        });

        if (existingUser) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            message: `Email ${row.email} already exists`,
          });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: row.email,
              password: await hashPassword(row.password || 'Faculty@123'),
              role: 'FACULTY',
            },
          });

          await tx.profile.create({
            data: {
              userId: user.id,
              firstName: row.firstName,
              lastName: row.lastName,
              phone: row.phone || null,
            },
          });

          await tx.faculty.create({
            data: {
              userId: user.id,
              employeeId: row.employeeId,
              designation: row.designation || 'Assistant Professor',
              departmentId: row.departmentId || '',
              joiningDate: row.joiningDate ? new Date(row.joiningDate) : new Date(),
              specialization: row.specialization || null,
            },
          });
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          message: (error as Error).message,
        });
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

    res.status(200).json({
      success: true,
      message: `Processed ${faculty.length} records`,
      data: results,
    });
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
        user: { include: { profile: true } },
        department: true,
        class: true,
      },
    });

    const data = students.map((s) => ({
      enrollmentId: s.enrollmentId,
      email: s.user.email,
      firstName: s.user.profile?.firstName,
      lastName: s.user.profile?.lastName,
      phone: s.user.profile?.phone,
      department: s.department?.name,
      class: s.class?.name,
      batchYear: s.batchYear,
      semester: s.semester,
      faceRegistered: s.faceRegistered,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
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

    res.status(200).json({
      success: true,
      data,
    });
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

    if (classId) {
      where.student = { classId: classId as string };
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: { include: { profile: true } },
            class: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const data = attendance.map((a) => ({
      date: a.date.toISOString().split('T')[0],
      enrollmentId: a.student.enrollmentId,
      studentName: `${a.student.user.profile?.firstName} ${a.student.user.profile?.lastName}`,
      class: a.student.class?.name,
      status: a.status,
      method: a.method,
      confidenceScore: a.confidenceScore,
      blockchainHash: a.blockchainHash,
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

    res.status(200).json({
      success: true,
      data,
    });
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
            studentId_date_subjectId: {
              studentId,
              date: attendanceDate,
              subjectId: null as any,
            },
          },
        });

        const updated = await prisma.attendance.update({
          where: {
            studentId_date_subjectId: {
              studentId,
              date: attendanceDate,
              subjectId: null as any,
            },
          },
          data: {
            status,
            verifiedBy: req.user.id,
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
  const csvRows = [];

  // Header
  csvRows.push(headers.join(','));

  // Rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}