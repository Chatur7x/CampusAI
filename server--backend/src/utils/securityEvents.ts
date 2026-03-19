import { prisma } from './prisma';
import { severity } from '@prisma/client';

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
  event_type: SecurityEventType;
  severity: severity;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  description: string;
  data?: Record<string, unknown>;
}

export async function createSecurityEvent(params: CreateEventParams): Promise<string> {
  const event = await prisma.securityAlert.create({
    data: {
      type: params.event_type,
      severity: params.severity,
      user_id: params.user_id,
      description: params.description,
      data: params.data as any,
    },
  });

  await autoResponse(event.id, params);
  return event.id;
}

async function autoResponse(eventId: string, params: CreateEventParams): Promise<void> {
  try {
    if (params.severity === 'CRITICAL' && params.user_id) {
      // Deactivate profile
      await prisma.profile.update({
        where: { user_id: params.user_id },
        data: { is_active: false, lockout_until: new Date(Date.now() + 24 * 3600 * 1000) },
      });

      await prisma.session.deleteMany({ where: { user_id: params.user_id } });

      const admins = await prisma.profile.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, is_active: true },
        select: { user_id: true },
      });

      await prisma.notification.createMany({
        data: admins.map(a => ({
          user_id: a.user_id,
          title: '🚨 CRITICAL Security Event',
          message: `${params.description}. User account has been auto-locked.`,
          type: 'SECURITY' as any,
        })),
      });
    }

    if (params.severity === 'HIGH' && params.user_id) {
      const admins = await prisma.profile.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, is_active: true },
        select: { user_id: true },
      });

      await prisma.notification.createMany({
        data: admins.map(a => ({
          user_id: a.user_id,
          title: '⚠️ High Security Alert',
          message: params.description,
          type: 'SECURITY' as any,
        })),
      });
    }

    if (params.event_type === 'brute_force' && params.user_id) {
      await prisma.profile.update({
        where: { user_id: params.user_id },
        data: { lockout_until: new Date(Date.now() + 60 * 60 * 1000) },
      });
    }

    if (params.event_type === 'geo_spoof' && params.data?.attendanceId) {
      await prisma.attendance.update({
        where: { id: params.data.attendanceId as string },
        data: { status: 'ABSENT', justification: 'Auto-rejected: GPS spoof detected' },
      });
    }
  } catch (error) {
    console.error('Auto-response failed for event', eventId, error);
  }
}

export async function getSecurityEvents(filters: {
  eventType?: string;
  severity?: severity;
  userId?: string;
  resolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const where: any = {};
  if (filters.eventType) where.type = filters.eventType;
  if (filters.severity) where.severity = filters.severity;
  if (filters.userId) where.user_id = filters.userId;
  if (filters.resolved !== undefined) where.resolved = filters.resolved;
  if (filters.startDate || filters.endDate) {
    where.created_at = {};
    if (filters.startDate) where.created_at.gte = filters.startDate;
    if (filters.endDate) where.created_at.lte = filters.endDate;
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;

  const [events, total] = await Promise.all([
    prisma.securityAlert.findMany({
      where,
      include: {
        users_security_alerts_user_idTousers: { select: { email: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.securityAlert.count({ where }),
  ]);

  return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function resolveSecurityEvent(eventId: string, resolvedByUserId: string): Promise<void> {
  await prisma.securityAlert.update({
    where: { id: eventId },
    data: {
      resolved: true,
      resolved_by: resolvedByUserId,
      resolved_at: new Date(),
    },
  });
}

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
  ] = await Promise.all([
    prisma.securityAlert.count({ where: { resolved: false } }),
    prisma.securityAlert.count({ where: { resolved: false, severity: 'CRITICAL' } }),
    prisma.loginHistory.count({ where: { status: 'failed', created_at: { gte: oneDayAgo } } }),
    prisma.loginHistory.count({ where: { status: 'success', created_at: { gte: oneDayAgo } } }),
    prisma.geoVerification.count({ where: { spoof_detected: true, created_at: { gte: sevenDaysAgo } } }),
    prisma.trustedDevice.count({ where: { is_trusted: true } }),
    prisma.securityAlert.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      include: { users_security_alerts_user_idTousers: { select: { email: true } } },
      orderBy: { created_at: 'desc' },
      take: 20,
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
  };
}

export async function detectBruteForce(ipAddress: string, userId?: string): Promise<boolean> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const failedCount = await prisma.loginHistory.count({
    where: {
      ip_address: ipAddress,
      status: 'failed',
      created_at: { gte: fifteenMinAgo },
    },
  });

  if (failedCount >= 5) {
    await createSecurityEvent({
      event_type: 'brute_force',
      severity: failedCount >= 10 ? 'CRITICAL' : 'HIGH',
      user_id: userId,
      ip_address: ipAddress,
      description: `Brute force detected: ${failedCount} failed attempts from IP ${ipAddress} in 15 minutes`,
      data: { failedCount },
    });
    return true;
  }
  return false;
}
