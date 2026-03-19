import { prisma } from '../utils/prisma';
import { NotificationCreate } from '../types';
import { io } from '../index';

export const createNotification = async (data: NotificationCreate): Promise<void> => {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: data.userId,
        title: data.title,
        message: data.message,
        type: data.type as any,
        data: (data.data || undefined) as any,
      },
    });

    io.to(`user:${data.userId}`).emit('notification', notification);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

export const markNotificationAsRead = async (notificationId: string, userId: string): Promise<boolean> => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId },
    });

    if (!notification) return false;

    await prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true },
    });

    return true;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
};

export const getUnreadNotifications = async (userId: string) => {
  try {
    return await prisma.notification.findMany({
      where: { user_id: userId, is_read: false },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
  } catch (error) {
    console.error('Failed to get unread notifications:', error);
    return [];
  }
};

export const getAllNotifications = async (userId: string, page: number = 1, limit: number = 20) => {
  try {
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { user_id: userId } }),
    ]);

    return {
      notifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return { notifications: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }
};

export const deleteNotification = async (notificationId: string, userId: string): Promise<boolean> => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId },
    });

    if (!notification) return false;

    await prisma.notification.delete({ where: { id: notificationId } });
    return true;
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return false;
  }
};

export const broadcastNotification = async (
  userIds: string[],
  title: string,
  message: string,
  type: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    const notifications = userIds.map((userId) => ({
      user_id: userId,
      title,
      message,
      type: type as any,
      data: (data || undefined) as any,
    }));

    await prisma.notification.createMany({ data: notifications as any });

    for (const userId of userIds) {
      io.to(`user:${userId}`).emit('notification', { title, message, type, data });
    }
  } catch (error) {
    console.error('Failed to broadcast notification:', error);
  }
};
