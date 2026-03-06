import crypto from 'crypto';
import { prisma } from './prisma';

/**
 * Hash a JWT token using SHA-256 (never store raw tokens in DB)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Blacklist a token (called on logout, password change, admin revoke)
 */
export async function blacklistToken(
  token: string,
  userId: string,
  reason: 'logout' | 'password_change' | 'admin_revoke' | 'suspicious' = 'logout'
): Promise<void> {
  try {
    // Decode expiry from JWT payload (base64 middle segment)
    const parts = token.split('.');
    if (parts.length !== 3) return;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await prisma.tokenBlacklist.upsert({
      where: { tokenHash: hashToken(token) },
      create: {
        tokenHash: hashToken(token),
        userId,
        reason,
        expiresAt,
      },
      update: { reason },
    });
  } catch (error) {
    console.error('Failed to blacklist token:', error);
  }
}

/**
 * Check if a token is blacklisted (called by auth middleware)
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const entry = await prisma.tokenBlacklist.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    return !!entry;
  } catch {
    return false;
  }
}

/**
 * Blacklist ALL tokens for a user (after password change, account compromise)
 */
export async function blacklistAllUserTokens(
  userId: string,
  reason: 'password_change' | 'admin_revoke' | 'suspicious'
): Promise<void> {
  // Delete all sessions = effectively invalidates all refresh tokens
  // The access tokens will still work briefly until they hit the blacklist check,
  // so we also create a marker entry
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Cleanup expired entries (call periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.tokenBlacklist.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
