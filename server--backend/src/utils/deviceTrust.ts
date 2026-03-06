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

/**
 * Generate a deterministic device hash from fingerprint data
 */
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

/**
 * Parse user-agent into browser + OS
 */
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

/**
 * Register or update a device for a user. Returns whether the device is new.
 */
export async function registerDevice(
  userId: string,
  deviceHash: string,
  info: DeviceInfo,
  ipAddress?: string
): Promise<{ isNew: boolean; isTrusted: boolean }> {
  const existing = await prisma.trustedDevice.findUnique({
    where: { userId_deviceHash: { userId, deviceHash } },
  });

  if (existing) {
    await prisma.trustedDevice.update({
      where: { id: existing.id },
      data: { lastUsedAt: new Date(), ipAddress },
    });
    return { isNew: false, isTrusted: existing.isTrusted };
  }

  const { browser, os } = parseUserAgent(info.userAgent || '');
  const deviceName = `${browser} on ${os}`;

  await prisma.trustedDevice.create({
    data: {
      userId,
      deviceHash,
      deviceName,
      browser,
      os,
      ipAddress,
      isTrusted: false,
    },
  });

  return { isNew: true, isTrusted: false };
}

/**
 * Get all devices for a user
 */
export async function getUserDevices(userId: string) {
  return prisma.trustedDevice.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
  });
}

/**
 * Trust/untrust a device
 */
export async function setDeviceTrust(
  deviceId: string,
  userId: string,
  trusted: boolean,
  ttlDays: number = 90
): Promise<void> {
  await prisma.trustedDevice.updateMany({
    where: { id: deviceId, userId },
    data: {
      isTrusted: trusted,
      trustExpiresAt: trusted ? new Date(Date.now() + ttlDays * 24 * 3600 * 1000) : null,
    },
  });
}

/**
 * Remove a device
 */
export async function removeDevice(deviceId: string, userId: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({
    where: { id: deviceId, userId },
  });
}

/**
 * Check if a device is trusted (and not expired)
 */
export async function isDeviceTrusted(userId: string, deviceHash: string): Promise<boolean> {
  const device = await prisma.trustedDevice.findUnique({
    where: { userId_deviceHash: { userId, deviceHash } },
  });

  if (!device || !device.isTrusted) return false;
  if (device.trustExpiresAt && device.trustExpiresAt < new Date()) {
    // Trust expired — mark as untrusted
    await prisma.trustedDevice.update({
      where: { id: device.id },
      data: { isTrusted: false },
    });
    return false;
  }
  return true;
}
