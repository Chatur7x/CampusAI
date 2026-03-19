import { prisma } from './prisma';
import { AuditLogEntry } from '../types';

export const logAction = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: entry.userId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        old_value: entry.oldValue || null,
        new_value: entry.newValue || null,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
};

export const getAuditLogs = async (
  filters: {
    userId?: string;
    entityType?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  },
  page: number = 1,
  limit: number = 50
) => {
  const where: any = {};

  if (filters.userId) where.user_id = filters.userId;
  if (filters.entityType) where.entity_type = filters.entityType;
  if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
  if (filters.startDate || filters.endDate) {
    where.created_at = {};
    if (filters.startDate) where.created_at.gte = filters.startDate;
    if (filters.endDate) where.created_at.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        users: {
          select: {
            email: true,
            profiles: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const exportAuditLogs = async (
  filters: {
    startDate?: Date;
    endDate?: Date;
    entityType?: string;
  }
) => {
  const where: any = {};

  if (filters.entityType) where.entity_type = filters.entityType;
  if (filters.startDate || filters.endDate) {
    where.created_at = {};
    if (filters.startDate) where.created_at.gte = filters.startDate;
    if (filters.endDate) where.created_at.lte = filters.endDate;
  }

  return prisma.auditLog.findMany({
    where,
    include: {
      users: {
        select: {
          email: true,
          role: true,
          profiles: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
};
