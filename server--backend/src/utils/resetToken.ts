import crypto from 'crypto';

interface ResetEntry {
  userId: string;
  expiresAt: number;
}

const resetTokenStore: Map<string, ResetEntry> = new Map();

export const issueResetToken = (userId: string, ttlMinutes: number = 60): string => {
  // Remove existing tokens for this user to avoid multiple valid tokens
  for (const [token, entry] of resetTokenStore.entries()) {
    if (entry.userId === userId) {
      resetTokenStore.delete(token);
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

  resetTokenStore.set(token, { userId, expiresAt });

  // Auto-cleanup after expiration
  setTimeout(() => {
    resetTokenStore.delete(token);
  }, ttlMinutes * 60 * 1000).unref?.();

  return token;
};

export const consumeResetToken = (token: string): string | null => {
  const entry = resetTokenStore.get(token);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    resetTokenStore.delete(token);
    return null;
  }

  resetTokenStore.delete(token);
  return entry.userId;
};
