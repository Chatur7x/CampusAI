import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';
import { io } from '../index';

// ==================== MESSAGING ====================
export const sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { receiverId, content, attachments } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Validate receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      res.status(404).json({ success: false, message: 'Receiver not found' });
      return;
    }

    // Check if messaging is allowed between these roles
    const canMessage = await canMessageEachOther(req.user.role, receiver.role);
    if (!canMessage) {
      res.status(403).json({ success: false, message: 'Messaging not allowed between these roles' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId,
        content,
        attachments: attachments || [],
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Emit real-time message via WebSocket
    io.to(`user:${receiverId}`).emit('new_message', message);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getConversations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Get all unique conversations
    const sentMessages = await prisma.message.findMany({
      where: { senderId: req.user.id },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: req.user.id },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const conversationUserIds = [
      ...new Set([
        ...sentMessages.map(m => m.receiverId),
        ...receivedMessages.map(m => m.senderId),
      ]),
    ];

    const conversations = await Promise.all(
      conversationUserIds.map(async (userId) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        });

        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: req.user!.id, receiverId: userId },
              { senderId: userId, receiverId: req.user!.id },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        const unreadCount = await prisma.message.count({
          where: {
            senderId: userId,
            receiverId: req.user!.id,
            isRead: false,
          },
        });

        return {
          user,
          lastMessage,
          unreadCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: req.user.id, receiverId: userId },
            { senderId: userId, receiverId: req.user.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          sender: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      prisma.message.count({
        where: {
          OR: [
            { senderId: req.user.id, receiverId: userId },
            { senderId: userId, receiverId: req.user.id },
          ],
        },
      }),
    ]);

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: req.user.id,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markMessagesAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: req.user.id,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      res.status(404).json({ success: false, message: 'Message not found' });
      return;
    }

    if (message.senderId !== req.user.id) {
      res.status(403).json({ success: false, message: 'Can only delete your own messages' });
      return;
    }

    await prisma.message.delete({ where: { id: messageId } });

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== GROUP CHAT (Class-based) ====================
export const getClassChat = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Check if user is part of this class
    const hasAccess = await checkClassAccess(req.user.id, req.user.role, classId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get class members
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: {
          include: {
            user: { include: { profile: true } },
          },
        },
        incharge: {
          include: {
            user: { include: { profile: true } },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        class: classData,
        members: [
          ...classData?.students.map(s => s.user) || [],
          classData?.incharge.user,
        ],
      },
    });
  } catch (error) {
    console.error('Get class chat error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== HELPER FUNCTIONS ====================
async function canMessageEachOther(senderRole: string, receiverRole: string): Promise<boolean> {
  // Define messaging rules
  const allowedPairs: { [key: string]: string[] } = {
    STUDENT: ['FACULTY', 'CLASS_INCHARGE', 'ADMIN'],
    FACULTY: ['STUDENT', 'FACULTY', 'CLASS_INCHARGE', 'ADMIN'],
    CLASS_INCHARGE: ['STUDENT', 'FACULTY', 'CLASS_INCHARGE', 'ADMIN'],
    ADMIN: ['STUDENT', 'FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'],
    SUPER_ADMIN: ['STUDENT', 'FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'],
  };

  return allowedPairs[senderRole]?.includes(receiverRole) || false;
}

async function checkClassAccess(userId: string, role: string, classId: string): Promise<boolean> {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return true;
  }

  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId },
    });
    return student?.classId === classId;
  }

  if (role === 'FACULTY' || role === 'CLASS_INCHARGE') {
    const faculty = await prisma.faculty.findUnique({
      where: { userId },
    });
    const cls = await prisma.class.findUnique({
      where: { id: classId },
    });
    return cls?.inchargeId === faculty?.id;
  }

  return false;
}