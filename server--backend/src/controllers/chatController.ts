import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { io } from '../index';

// ==================== CONVERSATIONS ====================

export const getConversations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { user_id: req.user.id } },
        is_active: true,
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profiles: { select: { first_name: true, last_name: true, avatar_url: true, role: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { id: true, content: true, sender_id: true, created_at: true, message_type: true },
        },
      },
      orderBy: { last_message_at: 'desc' },
    });

    // Attach unread count for current user
    const result = conversations.map((conv) => {
      const myParticipant = conv.participants.find((p) => p.user_id === req.user!.id);
      const otherParticipants = conv.participants.filter((p) => p.user_id !== req.user!.id);
      return {
        id: conv.id,
        type: conv.type,
        title: conv.title,
        lastMessage: conv.messages[0] || null,
        lastMessageAt: conv.last_message_at,
        unreadCount: myParticipant?.unread_count || 0,
        isMuted: myParticipant?.is_muted || false,
        participants: otherParticipants.map((p) => ({
          user_id: p.user_id,
          first_name: p.user.profiles?.first_name,
          last_name: p.user.profiles?.last_name,
          avatar: p.user.profiles?.avatar_url,
          role: p.user.profiles?.role,
        })),
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createOrGetDirectConversation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { receiverId } = req.body;
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

    // Check receiver exists
    const receiver = await prisma.users.findUnique({ where: { id: receiverId } });
    if (!receiver) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    // Check if direct conversation already exists between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        participants: { every: { user_id: { in: [req.user.id, receiverId] } } },
      },
      include: { participants: true },
    });

    if (existing && existing.participants.length === 2) {
      res.status(200).json({ success: true, data: existing });
      return;
    }

    // Create new direct conversation
    const conversation = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        created_by: req.user.id,
        participants: {
          create: [
            { user_id: req.user.id },
            { user_id: receiverId },
          ],
        },
      },
      include: { participants: true },
    });

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== MESSAGES ====================

export const getMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

    // Verify user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversation_id_user_id: { conversation_id: conversationId, user_id: req.user.id } },
    });
    if (!participant) { res.status(403).json({ success: false, message: 'Access denied' }); return; }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversation_id: conversationId },
        orderBy: { created_at: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          sender: {
            include: {
              profiles: { select: { first_name: true, last_name: true, avatar_url: true } },
            },
          },
          reply_to: {
            select: { id: true, content: true, sender_id: true },
          },
        },
      }),
      prisma.message.count({ where: { conversation_id: conversationId } }),
    ]);

    // Reset unread count for this user
    await prisma.conversationParticipant.update({
      where: { conversation_id_user_id: { conversation_id: conversationId, user_id: req.user.id } },
      data: { unread_count: 0, last_read_at: new Date() },
    });

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(),
        pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, content, attachments, replyToId, messageType } = req.body;
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

    // Verify participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversation_id_user_id: { conversation_id: conversationId, user_id: req.user.id } },
    });
    if (!participant) { res.status(403).json({ success: false, message: 'Not a participant' }); return; }

    const message = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        sender_id: req.user.id,
        content,
        attachments: attachments || [],
        message_type: messageType || 'TEXT',
        reply_to_id: replyToId || null,
      },
      include: {
        sender: {
          include: {
            profiles: { select: { first_name: true, last_name: true, avatar_url: true } },
          },
        },
      },
    });

    // Increment unread count for all other participants
    await prisma.conversationParticipant.updateMany({
      where: { conversation_id: conversationId, user_id: { not: req.user.id } },
      data: { unread_count: { increment: 1 } },
    });

    // Update conversation last_message_at
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date() },
    });

    // Emit real-time event
    io.to(`conversation:${conversationId}`).emit('new_message', message);

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) { res.status(404).json({ success: false, message: 'Message not found' }); return; }
    if (message.sender_id !== req.user.id) { res.status(403).json({ success: false, message: 'Can only delete your own messages' }); return; }

    await prisma.message.delete({ where: { id: messageId } });
    io.to(`conversation:${message.conversation_id}`).emit('message_deleted', { messageId });

    res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markMessagesAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

    await prisma.conversationParticipant.update({
      where: { conversation_id_user_id: { conversation_id: conversationId, user_id: req.user.id } },
      data: { unread_count: 0, last_read_at: new Date() },
    });

    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== CLASS GROUP CHAT ====================

export const getOrCreateClassConversation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { select: { user_id: true } },
        faculty: { select: { user_id: true } },
      },
    });
    if (!cls) { res.status(404).json({ success: false, message: 'Class not found' }); return; }

    // Check access
    const allUserIds = [...cls.students.map((s) => s.user_id), cls.faculty.user_id];
    if (!allUserIds.includes(req.user.id) && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Find or create class conversation
    let conversation = await prisma.conversation.findFirst({
      where: { type: 'CLASS', class_id: classId },
      include: { participants: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          type: 'CLASS',
          title: `${cls.name} - ${cls.section}`,
          class_id: classId,
          created_by: req.user.id,
          participants: {
            create: allUserIds.map((uid) => ({ user_id: uid })),
          },
        },
        include: { participants: true },
      });
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    console.error('Class conversation error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
