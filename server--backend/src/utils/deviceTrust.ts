import crypto from 'crypto';
import { prisma } from './prisma';

export interface DeviceInfo {
  browser?: string;
  os?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  gpu?: string;
  userAgent?: string;
}

export function generateDeviceHash(info: DeviceInfo): string {
  const raw = [
    info.browser || '',
    info.os || '',
    info.screenResolution || '',
    info.timezone || '',
    info.language || '',
    info.gpu || '',
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function parseUserAgent(ua: string): { browser: string; os: string } {
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
}

export async function registerDevice(
  userId: string,
  deviceHash: string,
  info: DeviceInfo,
  ipAddress?: string
): Promise<{ isNew: boolean; isTrusted: boolean }> {
  const existing = await prisma.trustedDevice.findUnique({
    where: { user_id_device_hash: { user_id: userId, device_hash: deviceHash } },
  });

  if (existing) {
    await prisma.trustedDevice.update({
      where: { id: existing.id },
      data: { last_used_at: new Date(), ip_address: ipAddress },
    });
    return { isNew: false, isTrusted: existing.is_trusted };
  }

  const { browser, os } = parseUserAgent(info.userAgent || '');
  const deviceName = `${browser} on ${os}`;

  await prisma.trustedDevice.create({
    data: {
      user_id: userId,
      device_hash: deviceHash,
      device_name: deviceName,
      browser,
      os,
      ip_address: ipAddress,
      is_trusted: false,
    },
  });

  return { isNew: true, isTrusted: false };
}

export async function getUserDevices(userId: string) {
  return prisma.trustedDevice.findMany({
    where: { user_id: userId },
    orderBy: { last_used_at: 'desc' },
  });
}

export async function setDeviceTrust(
  deviceId: string,
  userId: string,
  trusted: boolean,
  ttlDays: number = 90
): Promise<void> {
  await prisma.trustedDevice.updateMany({
    where: { id: deviceId, user_id: userId },
    data: {
      is_trusted: trusted,
      trust_expires_at: trusted ? new Date(Date.now() + ttlDays * 24 * 3600 * 1000) : null,
    },
  });
}

export async function removeDevice(deviceId: string, userId: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({
    where: { id: deviceId, user_id: userId },
  });
}

export async function isDeviceTrusted(userId: string, deviceHash: string): Promise<boolean> {
  const device = await prisma.trustedDevice.findUnique({
    where: { user_id_device_hash: { user_id: userId, device_hash: deviceHash } },
  });

  if (!device || !device.is_trusted) return false;
  if (device.trust_expires_at && device.trust_expires_at < new Date()) {
    await prisma.trustedDevice.update({
      where: { id: device.id },
      data: { is_trusted: false },
    });
    return false;
  }
  return true;
}
