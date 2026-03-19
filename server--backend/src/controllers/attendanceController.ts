import { Response } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';
import { createNotification } from '../services/notificationService';
import { env } from '../config/env';
import { verifyFaceExternal } from '../utils/faceVerification';

const getPreviousAttendanceHash = async (): Promise<string | null> => {
  const latest = await prisma.attendance.findFirst({
    where: { blockchain_hash: { not: null } },
    orderBy: { created_at: 'desc' },
    select: { blockchain_hash: true },
  });
  return latest?.blockchain_hash || null;
};

const generateAttendanceHash = (payload: Record<string, unknown>): string => {
  const salted = { ...payload, salt: env.blockchainSalt };
  return crypto.createHash('sha256').update(JSON.stringify(salted)).digest('hex');
};

// ==================== AI FACE ATTENDANCE ====================
export const markAttendanceWithFace = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId, faceData, location, device_info, subjectId, sessionId } = req.body;

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { users: { include: { profiles: true } } },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    // Check if face is registered
    if (!student.face_registered || !student.face_data) {
      res.status(400).json({ success: false, message: 'Face not registered. Please register your face first.' });
      return;
    }

    // Delegate to external face verification provider; fail fast if not configured
    let verificationResult;
    try {
      verificationResult = await verifyFaceExternal(student.face_data, faceData);
    } catch (err) {
      console.error('Face verification error:', err);
      res.status(503).json({ success: false, message: 'Face verification service unavailable' });
      return;
    }

    if (!verificationResult.isMatch) {
      // Log security alert
      await prisma.securityAlert.create({
        data: {
          type: 'face_mismatch',
          severity: 'HIGH',
          user_id: student.user_id,
          description: `Face verification failed for student ${student.enrollment_id}`,
          data: { confidence: verificationResult.confidence },
        },
      });

      res.status(401).json({
        success: false,
        message: 'Face verification failed',
        data: { confidence: verificationResult.confidence },
      });
      return;
    }

    // Check confidence threshold
    if (verificationResult.confidence < env.faceConfidenceThreshold) {
      res.status(401).json({
        success: false,
        message: 'Face confidence too low. Please try again.',
        data: { confidence: verificationResult.confidence },
      });
      return;
    }

    const previous_hash = await getPreviousAttendanceHash();
    const blockchain_hash = generateAttendanceHash({
      studentId,
      subjectId,
      date: new Date().toISOString(),
      method: 'AI_FACE',
      confidence: verificationResult.confidence,
      previous_hash,
    });

    // Create attendance record
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.upsert({
      where: {
        student_id_date_subject_id: {
          student_id: studentId,
          date: today,
          subject_id: subjectId || null,
        },
      },
      update: {
        status: 'PRESENT',
        method: 'AI_FACE',
        confidence_score: verificationResult.confidence,
        location: location ? { lat: location.lat, lng: location.lng } : Prisma.JsonNull,
        device_info: device_info || req.headers['user-agent'],
        session_id: sessionId || null,
        blockchain_hash: blockchain_hash,
        previous_hash: previous_hash,
      },
      create: {
        student_id: studentId,
        subject_id: subjectId || null,
        date: today,
        status: 'PRESENT',
        method: 'AI_FACE',
        confidence_score: verificationResult.confidence,
        location: location ? { lat: location.lat, lng: location.lng } : Prisma.JsonNull,
        device_info: device_info || req.headers['user-agent'],
        session_id: sessionId || null,
        blockchain_hash: blockchain_hash,
        previous_hash: previous_hash,
      },
    });

    // Log action
    await logAction({
      userId: req.user?.id,
      action: 'MARK_ATTENDANCE_AI',
      entityType: 'attendance',
      entityId: attendance.id,
      newValue: attendance,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Create notification
    await createNotification({
      userId: student.user_id,
      title: 'Attendance Marked',
      message: `Your attendance has been marked as PRESENT via face recognition.`,
      type: 'ATTENDANCE',
      data: { attendanceId: attendance.id },
    });

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        attendance,
        verification: {
          confidence: verificationResult.confidence,
          livenessScore: verificationResult.livenessScore,
        },
        blockchain: {
          hash: blockchain_hash,
          previous_hash,
        },
      },
    });
  } catch (error) {
    console.error('Face attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== MANUAL ATTENDANCE ====================
export const markAttendanceManual = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId, status, subjectId, justification } = req.body;

    // Verify faculty permission
    if (!req.user || (req.user.role !== 'FACULTY' && req.user.role !== 'CLASS_INCHARGE' && req.user.role !== 'ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { users: true },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const previous_hash = await getPreviousAttendanceHash();
    const blockchain_hash = generateAttendanceHash({
      studentId,
      subjectId,
      date: today.toISOString(),
      method: 'MANUAL',
      status,
      verified_by: req.user.id,
      justification,
      previous_hash,
    });

    const attendance = await prisma.attendance.upsert({
      where: {
        student_id_date_subject_id: {
          student_id: studentId,
          date: today,
          subject_id: subjectId || null,
        },
      },
      update: {
        status,
        method: 'MANUAL',
        verified_by: req.user.id,
        justification,
        blockchain_hash: blockchain_hash,
        previous_hash: previous_hash,
      },
      create: {
        student_id: studentId,
        subject_id: subjectId || null,
        date: today,
        status,
        method: 'MANUAL',
        verified_by: req.user.id,
        justification,
        blockchain_hash: blockchain_hash,
        previous_hash: previous_hash,
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'MARK_ATTENDANCE_MANUAL',
      entityType: 'attendance',
      entityId: attendance.id,
      newValue: attendance,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Notify student
    await createNotification({
      userId: student.user_id,
      title: 'Attendance Updated',
      message: `Your attendance has been marked as ${status} by faculty.`,
      type: 'ATTENDANCE',
      data: { attendanceId: attendance.id },
    });

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: { attendance, blockchain: { hash: blockchain_hash, previous_hash } },
    });
  } catch (error) {
    console.error('Manual attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== BULK ATTENDANCE ====================
export const markBulkAttendance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId, subjectId, date, attendanceList } = req.body;

    if (!req.user || (req.user.role !== 'FACULTY' && req.user.role !== 'CLASS_INCHARGE' && req.user.role !== 'ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const results = [];
    const errors = [];

    let previous_hash = await getPreviousAttendanceHash();

    for (const entry of attendanceList) {
      try {
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        const blockchain_hash = generateAttendanceHash({
          student_id: entry.studentId,
          subjectId,
          date: attendanceDate.toISOString(),
          method: 'MANUAL',
          status: entry.status,
          verified_by: req.user.id,
          justification: entry.justification,
          previous_hash,
        });

        const attendance = await prisma.attendance.upsert({
          where: {
            student_id_date_subject_id: {
              student_id: entry.studentId,
              date: attendanceDate,
              subject_id: subjectId || null,
            },
          },
          update: {
            status: entry.status,
            method: 'MANUAL',
            verified_by: req.user.id,
            justification: entry.justification,
            blockchain_hash: blockchain_hash,
            previous_hash: previous_hash,
          },
          create: {
            student_id: entry.studentId,
            subject_id: subjectId || null,
            date: attendanceDate,
            status: entry.status,
            method: 'MANUAL',
            verified_by: req.user.id,
            justification: entry.justification,
            blockchain_hash: blockchain_hash,
            previous_hash: previous_hash,
          },
        });

        results.push(attendance);
        previous_hash = blockchain_hash;
      } catch (err) {
        errors.push({ student_id: entry.studentId, error: (err as Error).message });
      }
    }

    await logAction({
      userId: req.user.id,
      action: 'MARK_BULK_ATTENDANCE',
      entityType: 'attendance',
      newValue: { count: results.length, class_id: classId, subject_id: subjectId, date },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Marked attendance for ${results.length} students`,
      data: { results, errors },
    });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== GET ATTENDANCE ====================
export const getStudentAttendance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, subjectId } = req.query;

    // Check permissions
    if (req.user?.role === 'STUDENT' && req.user.id !== studentId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const where: any = { student_id: studentId };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (subjectId) {
      where.subject_id = subjectId as string;
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        students: {
          include: {
            users: { include: { profiles: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate statistics
    const total = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const absentCount = attendance.filter(a => a.status === 'ABSENT').length;
    const lateCount = attendance.filter(a => a.status === 'LATE').length;
    const excusedCount = attendance.filter(a => a.status === 'EXCUSED').length;

    const percentage = total > 0 ? ((presentCount + lateCount) / total) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        attendance,
        statistics: {
          total,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          percentage: Math.round(percentage * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getClassAttendance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const students = await prisma.student.findMany({
      where: { class_id: classId },
      include: {
        users: { include: { profiles: true } },
        attendance: {
          where: { date: targetDate },
        },
      },
    });

    const attendanceData = students.map(student => ({
      student_id: student.id,
      enrollment_id: student.enrollment_id,
      name: `${student.users.profiles?.first_name} ${student.users.profiles?.last_name}`,
      avatar: student.users.profiles?.avatar_url,
      status: (student.attendance[0]?.status || 'NOT_MARKED') as string,
      method: student.attendance[0]?.method,
      confidence_score: student.attendance[0]?.confidence_score,
    }));

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        students: attendanceData,
        summary: {
          total: students.length,
          present: attendanceData.filter(a => a.status === 'PRESENT').length,
          absent: attendanceData.filter(a => a.status === 'ABSENT').length,
          late: attendanceData.filter(a => a.status === 'LATE').length,
          notMarked: attendanceData.filter(a => a.status === 'NOT_MARKED').length,
        },
      },
    });
  } catch (error) {
    console.error('Get class attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== ATTENDANCE ANALYTICS ====================
export const getAttendanceAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        attendance: true,
        classes: true,
      },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const attendance = student.attendance;
    const total = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const absentCount = attendance.filter(a => a.status === 'ABSENT').length;
    const lateCount = attendance.filter(a => a.status === 'LATE').length;

    const currentPercentage = total > 0 ? ((presentCount + lateCount * 0.5) / total) * 100 : 0;

    // Calculate trend
    const sortedAttendance = attendance.sort((a, b) => a.date.getTime() - b.date.getTime());
    const recentAttendance = sortedAttendance.slice(-10);
    const recentPresent = recentAttendance.filter(a => a.status === 'PRESENT').length;
    const recentPercentage = recentAttendance.length > 0 ? (recentPresent / recentAttendance.length) * 100 : 0;

    let trend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
    if (recentPercentage > currentPercentage + 5) trend = 'IMPROVING';
    else if (recentPercentage < currentPercentage - 5) trend = 'DECLINING';

    // Risk assessment
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (currentPercentage < 60) riskLevel = 'HIGH';
    else if (currentPercentage < 75) riskLevel = 'MEDIUM';

    // Predictions (Simple heuristic)
    const requiredPercentage = 75;
    const classesNeeded = Math.max(0, Math.ceil((requiredPercentage * total - (presentCount + lateCount * 0.5) * 100) / (100 - requiredPercentage)));
    const safeAbsenceMargin = Math.max(0, Math.floor((currentPercentage - requiredPercentage) * total / 100));

    // Monthly breakdown
    const monthlyData: { [key: string]: { present: number; absent: number; total: number } } = {};
    attendance.forEach(a => {
      const month = a.date.toISOString().slice(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { present: 0, absent: 0, total: 0 };
      }
      monthlyData[month].total++;
      if (a.status === 'PRESENT') monthlyData[month].present++;
      if (a.status === 'ABSENT') monthlyData[month].absent++;
    });

    res.status(200).json({
      success: true,
      data: {
        overallPercentage: Math.round(currentPercentage * 100) / 100,
        presentCount,
        absentCount,
        lateCount,
        totalClasses: total,
        riskLevel,
        trend,
        predictions: {
          predictedPercentage: Math.round(recentPercentage * 100) / 100,
          classesNeeded,
          safeAbsenceMargin,
        },
        monthlyBreakdown: monthlyData,
      },
    });
  } catch (error) {
    console.error('Attendance analytics error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== FACE REGISTRATION ====================
export const registerFace = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId, faceData } = req.body;

    // Check permissions
    if (req.user?.role === 'STUDENT' && req.user.id !== studentId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        face_data: faceData,
        face_registered: true,
      },
    });

    await logAction({
      userId: req.user?.id,
      action: 'REGISTER_FACE',
      entityType: 'student',
      entityId: studentId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Face registered successfully',
      data: { student_id: student.id, face_registered: true },
    });
  } catch (error) {
    console.error('Face registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
