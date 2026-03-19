import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';
import { createNotification } from '../services/notificationService';

// ==================== CRUD OPERATIONS ====================
export const createNotice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, content, priority, target_roles, target_departments, target_classes, attachments, expiry_date } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'FACULTY')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const notice = await prisma.notice.create({
      data: {
        title,
        content,
        priority: priority || 'MEDIUM',
        target_roles: target_roles || [],
        target_departments: target_departments || [],
        target_classes: target_classes || [],
        attachments: attachments || [],
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        published_by: req.user.id,
        is_active: true
      },
    });

    // Notify target users
    const targetUsers = await prisma.profile.findMany({
      where: {
        role: { in: target_roles },
        is_active: true,
      },
      select: { user_id: true },
    });

    for (const profile of targetUsers) {
      await createNotification({
        userId: profile.user_id,
        title: `New Notice: ${title}`,
        message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        type: 'NOTICE',
        data: { noticeId: notice.id },
      });
    }

    await logAction({
      userId: req.user.id,
      action: 'CREATE_NOTICE',
      entityType: 'notice',
      entityId: notice.id,
      newValue: notice,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: notice,
    });
  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getNotices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, priority, search } = req.query;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const where: any = {
      is_active: true,
      OR: [
        { target_roles: { has: req.user.role } },
        { target_roles: { isEmpty: true } },
      ],
      AND: [
        {
          OR: [
            { expiry_date: null },
            { expiry_date: { gte: new Date() } },
          ],
        },
      ],
    };

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { content: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [notices, total] = await Promise.all([
      prisma.notice.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { created_at: 'desc' },
        ],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.notice.count({ where }),
    ]);

    // Get read status for each notice
    const noticesWithReadStatus = await Promise.all(
      notices.map(async (notice) => {
        const read = await prisma.noticeRead.findUnique({
          where: {
            notice_id_user_id: {
              notice_id: notice.id,
              user_id: req.user!.id,
            },
          },
        });
        return { ...notice, is_read: !!read };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        notices: noticesWithReadStatus,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getNoticeById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notice = await prisma.notice.findUnique({
      where: { id },
    });

    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found' });
      return;
    }

    // Mark as read
    if (req.user) {
      await prisma.noticeRead.upsert({
        where: {
          notice_id_user_id: {
            notice_id: id,
            user_id: req.user.id,
          },
        },
        update: {},
        create: {
          notice_id: id,
          user_id: req.user.id,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    console.error('Get notice error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateNotice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, priority, target_roles, target_departments, target_classes, attachments, expiry_date, is_active } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingNotice = await prisma.notice.findUnique({ where: { id } });
    if (!existingNotice) {
      res.status(404).json({ success: false, message: 'Notice not found' });
      return;
    }

    const notice = await prisma.notice.update({
      where: { id },
      data: {
        title,
        content,
        priority,
        target_roles: target_roles,
        target_departments: target_departments,
        target_classes: target_classes,
        attachments,
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        is_active: is_active !== undefined ? is_active : true,
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'UPDATE_NOTICE',
      entityType: 'notice',
      entityId: notice.id,
      oldValue: existingNotice,
      newValue: notice,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Notice updated successfully',
      data: notice,
    });
  } catch (error) {
    console.error('Update notice error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteNotice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingNotice = await prisma.notice.findUnique({ where: { id } });
    if (!existingNotice) {
      res.status(404).json({ success: false, message: 'Notice not found' });
      return;
    }

    // Soft delete
    const notice = await prisma.notice.update({
      where: { id },
      data: { is_active: false },
    });

    await logAction({
      userId: req.user.id,
      action: 'DELETE_NOTICE',
      entityType: 'notice',
      entityId: notice.id,
      oldValue: existingNotice,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Notice deleted successfully',
    });
  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== STATISTICS ====================
export const getNoticeStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const totalNotices = await prisma.notice.count();
    const activeNotices = await prisma.notice.count({ where: { is_active: true } });
    const expiredNotices = await prisma.notice.count({
      where: {
        expiry_date: { lt: new Date() },
      },
    });

    const priorityStats = await prisma.notice.groupBy({
      by: ['priority'],
      _count: { priority: true },
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalNotices,
        active: activeNotices,
        expired: expiredNotices,
        byPriority: priorityStats,
      },
    });
  } catch (error) {
    console.error('Get notice stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};