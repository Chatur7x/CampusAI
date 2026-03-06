import { prisma } from './prisma';
import { Severity } from '@prisma/client';

export type SecurityEventType =
  | 'login_anomaly'
  | 'geo_spoof'
  | 'device_mismatch'
  | 'brute_force'
  | 'api_abuse'
  | 'data_tamper'
  | 'token_reuse'
  | 'unauthorized_access'
  | 'mfa_bypass_attempt'
  | 'suspicious_export';

interface CreateEventParams {
  eventType: SecurityEventType;
  severity: Severity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a security event and trigger automatic incident response
 */
export async function createSecurityEvent(params: CreateEventParams): Promise<string> {
  const event = await prisma.securityEvent.create({
    data: {
      eventType: params.eventType,
      severity: params.severity,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      description: params.description,
      metadata: params.metadata as any,
    },
  });

  // Automated incident response based on severity
  await autoResponse(event.id, params);

  return event.id;
}

/**
 * Automatic incident response engine
 */
async function autoResponse(eventId: string, params: CreateEventParams): Promise<void> {
  try {
    // CRITICAL: Lock the account immediately
    if (params.severity === 'CRITICAL' && params.userId) {
      await prisma.user.update({
        where: { id: params.userId },
        data: {
          isActive: false,
          lockoutUntil: new Date(Date.now() + 24 * 3600 * 1000), // lock 24h
        },
      });

      // Revoke all sessions
      await prisma.session.deleteMany({ where: { userId: params.userId } });

      // Notify admins
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
        select: { id: true },
      });

      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          title: `🚨 CRITICAL Security Event`,
          message: `${params.description}. User account has been auto-locked.`,
          type: 'SECURITY',
        })),
      });
    }

    // HIGH: Send alert to admins, increase monitoring
    if (params.severity === 'HIGH' && params.userId) {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
        select: { id: true },
      });

      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          title: `⚠️ High Security Alert`,
          message: params.description,
          type: 'SECURITY',
        })),
      });
    }

    // BRUTE FORCE: Lock account after pattern detected
    if (params.eventType === 'brute_force' && params.userId) {
      await prisma.user.update({
        where: { id: params.userId },
        data: {
          lockoutUntil: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });
    }

    // GEO SPOOF: Flag the attendance record
    if (params.eventType === 'geo_spoof' && params.metadata?.attendanceId) {
      await prisma.attendance.update({
        where: { id: params.metadata.attendanceId as string },
        data: { status: 'ABSENT', justification: 'Auto-rejected: GPS spoof detected' },
      });
    }
  } catch (error) {
    console.error('Auto-response failed for event', eventId, error);
  }
}

/**
 * Get security events with filters
 */
export async function getSecurityEvents(filters: {
  eventType?: string;
  severity?: Severity;
  userId?: string;
  resolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const where: any = {};
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.severity) where.severity = filters.severity;
  if (filters.userId) where.userId = filters.userId;
  if (filters.resolved !== undefined) where.resolved = filters.resolved;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      include: { user: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Resolve a security event
 */
export async function resolveSecurityEvent(
  eventId: string,
  resolvedByUserId: string
): Promise<void> {
  await prisma.securityEvent.update({
    where: { id: eventId },
    data: {
      resolved: true,
      resolvedBy: resolvedByUserId,
      resolvedAt: new Date(),
    },
  });
}

/**
 * Get security dashboard statistics
 */
export async function getSecurityStats() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    openEvents,
    criticalEvents,
    failedLogins24h,
    successfulLogins24h,
    spoofDetections7d,
    trustedDeviceCount,
    recentEvents,
    eventsByType,
  ] = await Promise.all([
    prisma.securityEvent.count({ where: { resolved: false } }),
    prisma.securityEvent.count({ where: { resolved: false, severity: 'CRITICAL' } }),
    prisma.loginHistory.count({ where: { status: 'failed', createdAt: { gte: oneDayAgo } } }),
    prisma.loginHistory.count({ where: { status: 'success', createdAt: { gte: oneDayAgo } } }),
    prisma.geoVerification.count({ where: { spoofDetected: true, createdAt: { gte: sevenDaysAgo } } }),
    prisma.trustedDevice.count({ where: { isTrusted: true } }),
    prisma.securityEvent.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.securityEvent.groupBy({
      by: ['eventType'],
      _count: { id: true },
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  return {
    openEvents,
    criticalEvents,
    failedLogins24h,
    successfulLogins24h,
    spoofDetections7d,
    trustedDeviceCount,
    recentEvents,
    eventsByType: eventsByType.map(e => ({ type: e.eventType, count: e._count.id })),
  };
}

/**
 * Detect brute force pattern: >5 failed logins in 15 min from same IP
 */
export async function detectBruteForce(ipAddress: string, userId?: string): Promise<boolean> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const failedCount = await prisma.loginHistory.count({
    where: {
      ipAddress,
      status: 'failed',
      createdAt: { gte: fifteenMinAgo },
    },
  });

  if (failedCount >= 5) {
    await createSecurityEvent({
      eventType: 'brute_force',
      severity: failedCount >= 10 ? 'CRITICAL' : 'HIGH',
      userId,
      ipAddress,
      description: `Brute force detected: ${failedCount} failed attempts from IP ${ipAddress} in 15 minutes`,
      metadata: { failedCount },
    });
    return true;
  }
  return false;
}
