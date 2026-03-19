import { prisma } from './prisma';

export type LoginStatus = 'success' | 'failed' | 'locked' | 'mfa_required';

export async function logLogin(params: {
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  deviceHash?: string;
  location?: { lat: number; lng: number; city?: string; country?: string };
  status: LoginStatus;
  failure_reason?: string;
}): Promise<void> {
  try {
    await prisma.loginHistory.create({
      data: {
        user_id: params.user_id,
        ip_address: params.ip_address,
        user_agent: params.user_agent,
        device_hash: params.deviceHash,
        location: params.location as any,
        status: params.status,
        failure_reason: params.failure_reason,
      },
    });
  } catch (error) {
    console.error('Failed to log login:', error);
  }
}

export async function getLoginHistory(userId: string, limit = 20) {
  return prisma.loginHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}

export async function getAllLoginHistory(filters: {
  userId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const where: any = {};
  if (filters.userId) where.user_id = filters.userId;
  if (filters.status) where.status = filters.status;
  if (filters.startDate || filters.endDate) {
    where.created_at = {};
    if (filters.startDate) where.created_at.gte = filters.startDate;
    if (filters.endDate) where.created_at.lte = filters.endDate;
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;

  const [logs, total] = await Promise.all([
    prisma.loginHistory.findMany({
      where,
      include: { users: { select: { email: true, role: true } } },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.loginHistory.count({ where }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}
