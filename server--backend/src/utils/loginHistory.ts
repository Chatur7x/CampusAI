import { prisma } from './prisma';

export type LoginStatus = 'success' | 'failed' | 'locked' | 'mfa_required';

export async function logLogin(params: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceHash?: string;
  location?: { lat: number; lng: number; city?: string; country?: string };
  status: LoginStatus;
  failureReason?: string;
}): Promise<void> {
  try {
    await prisma.loginHistory.create({
      data: {
        userId: params.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        deviceHash: params.deviceHash,
        location: params.location as any,
        status: params.status,
        failureReason: params.failureReason,
      },
    });
  } catch (error) {
    console.error('Failed to log login:', error);
  }
}

/**
 * Get login history for a user
 */
export async function getLoginHistory(userId: string, limit = 20) {
  return prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get all login history (admin)
 */
export async function getAllLoginHistory(filters: {
  userId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const where: any = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.status) where.status = filters.status;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;

  const [logs, total] = await Promise.all([
    prisma.loginHistory.findMany({
      where,
      include: { user: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.loginHistory.count({ where }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}
