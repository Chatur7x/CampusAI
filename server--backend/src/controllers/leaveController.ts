import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';
import { createNotification } from '../services/notificationService';

// ==================== STUDENT LEAVE REQUESTS ====================
export const createLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, reason, type, documents } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Get student record
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' });
      return;
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        studentId: student.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        type,
        documents: documents || [],
        status: 'PENDING',
      },
    });

    // Notify class incharge
    let classIncharge: any = null;
    if (student.classId) {
      const classRecord = await prisma.class.findUnique({
        where: { id: student.classId },
        select: { inchargeId: true },
      });
      if (classRecord?.inchargeId) {
        classIncharge = await prisma.faculty.findUnique({
          where: { id: classRecord.inchargeId },
        });
      }
    }

    if (classIncharge) {
      await createNotification({
        userId: classIncharge.userId,
        title: 'New Leave Request',
        message: `Student has requested leave from ${startDate} to ${endDate}`,
        type: 'LEAVE',
        data: { leaveRequestId: leaveRequest.id },
      });
    }

    await logAction({
      userId: req.user.id,
      action: 'CREATE_LEAVE_REQUEST',
      entityType: 'leave_request',
      entityId: leaveRequest.id,
      newValue: leaveRequest,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Leave request created successfully',
      data: leaveRequest,
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyLeaveRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' });
      return;
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: leaveRequests,
    });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const cancelLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' });
      return;
    }

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: { id, studentId: student.id },
    });

    if (!leaveRequest) {
      res.status(404).json({ success: false, message: 'Leave request not found' });
      return;
    }

    if (leaveRequest.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Cannot cancel processed leave request' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await logAction({
      userId: req.user.id,
      action: 'CANCEL_LEAVE_REQUEST',
      entityType: 'leave_request',
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Cancel leave request error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== FACULTY/APPROVAL WORKFLOW ====================
export const getPendingLeaveRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'FACULTY' && req.user.role !== 'CLASS_INCHARGE' && req.user.role !== 'ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { page = 1, limit = 10 } = req.query;

    const where: any = { status: 'PENDING' };

    // If faculty, only show requests from their classes
    if (req.user.role === 'FACULTY' || req.user.role === 'CLASS_INCHARGE') {
      const faculty = await prisma.faculty.findUnique({
        where: { userId: req.user.id },
      });
      if (faculty) {
        const classes = await prisma.class.findMany({
          where: { inchargeId: faculty.id },
          select: { id: true },
        });
        const classIds = classes.map(c => c.id);
        where.student = { classId: { in: classIds } };
      }
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          student: {
            include: {
              user: { include: { profile: true } },
              class: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        requests,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get pending leave requests error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const approveLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;

    if (!req.user || (req.user.role !== 'FACULTY' && req.user.role !== 'CLASS_INCHARGE' && req.user.role !== 'ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const faculty = await prisma.faculty.findUnique({
      where: { userId: req.user.id },
    });

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true } } },
    });

    if (!leaveRequest) {
      res.status(404).json({ success: false, message: 'Leave request not found' });
      return;
    }

    if (leaveRequest.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Leave request already processed' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: faculty?.id,
        approvedAt: new Date(),
        comments,
      },
    });

    // Mark attendance as ON_LEAVE for approved requests
    if (status === 'APPROVED') {
      const startDate = new Date(leaveRequest.startDate);
      const endDate = new Date(leaveRequest.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);

        await prisma.attendance.upsert({
          where: {
            studentId_date_subjectId: {
              studentId: leaveRequest.studentId,
              date,
              subjectId: null as any,
            },
          },
          update: { status: 'ON_LEAVE' },
          create: {
            studentId: leaveRequest.studentId,
            date,
            status: 'ON_LEAVE',
            method: 'MANUAL',
          },
        });
      }
    }

    // Notify student
    await createNotification({
      userId: leaveRequest.student.userId,
      title: `Leave Request ${status}`,
      message: `Your leave request has been ${status.toLowerCase()}.${comments ? ` Comments: ${comments}` : ''}`,
      type: 'LEAVE',
      data: { leaveRequestId: id },
    });

    await logAction({
      userId: req.user.id,
      action: `${status}_LEAVE_REQUEST`,
      entityType: 'leave_request',
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== STATISTICS ====================
export const getLeaveStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const stats = await prisma.leaveRequest.groupBy({
      by: ['status', 'type'],
      where: { studentId },
      _count: { status: true },
    });

    const totalStats = await prisma.leaveRequest.aggregate({
      where: { studentId },
      _count: { id: true },
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalStats._count.id,
        breakdown: stats,
      },
    });
  } catch (error) {
    console.error('Get leave stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};