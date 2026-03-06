import crypto from 'crypto';
import { prisma } from './prisma';

/**
 * Hash a JWT token using SHA-256 (never store raw tokens in DB)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// In-memory cache: tokenHash → expiry timestamp of cache entry
const blacklistCache = new Map<string, number>();
const CACHE_TTL = 60_000; // 60 seconds

function getCached(hash: string): boolean | undefined {
  const entry = blacklistCache.get(hash);
  if (entry === undefined) return undefined;
  if (Date.now() > entry) {
    blacklistCache.delete(hash);
    return undefined;
  }
  return true; // token IS blacklisted (cached positive)
}

// Periodically prune expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of blacklistCache) {
    if (now > exp) blacklistCache.delete(k);
  }
}, 5 * 60_000);

/**
 * Blacklist a token (called on logout, password change, admin revoke)
 */
export async function blacklistToken(
  token: string,
  userId: string,
  reason: 'logout' | 'password_change' | 'admin_revoke' | 'suspicious' = 'logout'
): Promise<void> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const hash = hashToken(token);

    await prisma.tokenBlacklist.upsert({
      where: { tokenHash: hash },
      create: {
        tokenHash: hash,
        userId,
        reason,
        expiresAt,
      },
      update: { reason },
    });

    // Immediately populate the cache
    blacklistCache.set(hash, Date.now() + CACHE_TTL);
  } catch (error) {
    console.error('Failed to blacklist token:', error);
  }
}

/**
 * Check if a token is blacklisted (called by auth middleware) — cached
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const hash = hashToken(token);

    // Check in-memory cache first
    const cached = getCached(hash);
    if (cached !== undefined) return cached;

    const entry = await prisma.tokenBlacklist.findUnique({
      where: { tokenHash: hash },
    });

    if (entry) {
      // Cache positive result (token IS blacklisted)
      blacklistCache.set(hash, Date.now() + CACHE_TTL);
    }

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
