import { prisma } from '../utils/prisma';
import { NotificationCreate } from '../types';

export const createNotification = async (data: NotificationCreate): Promise<void> => {
  try {
    await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type as any,
        data: (data.data || undefined) as any,
      },
    });

    // TODO: Emit real-time notification via WebSocket
    // io.to(`user:${data.userId}`).emit('notification', notification);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

export const markNotificationAsRead = async (notificationId: string, userId: string): Promise<boolean> => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return false;
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
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
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
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
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return { notifications: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }
};

export const deleteNotification = async (notificationId: string, userId: string): Promise<boolean> => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return false;
    }

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
      userId,
      title,
      message,
      type: type as any,
      data: (data || undefined) as any,
    }));

    await prisma.notification.createMany({
      data: notifications as any,
    });

    // TODO: Emit real-time notifications via WebSocket
    // for (const userId of userIds) {
    //   io.to(`user:${userId}`).emit('notification', { title, message, type, data });
    // }
  } catch (error) {
    console.error('Failed to broadcast notification:', error);
  }
};