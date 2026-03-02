import crypto from 'crypto';

const otpStore: Map<string, { otp: string; expiresAt: number }> = new Map();

export const generateOTP = (length: number = 6): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

export const storeOTP = (identifier: string, otp: string, expiryMinutes: number = 10): void => {
  const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
  otpStore.set(identifier, { otp, expiresAt });
  
  // Auto-cleanup after expiry
  setTimeout(() => {
    otpStore.delete(identifier);
  }, expiryMinutes * 60 * 1000);
};

export const verifyOTP = (identifier: string, otp: string): boolean => {
  const stored = otpStore.get(identifier);
  
  if (!stored) {
    return false;
  }
  
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(identifier);
    return false;
  }
  
  if (stored.otp !== otp) {
    return false;
  }
  
  // Clear OTP after successful verification
  otpStore.delete(identifier);
  return true;
};

export const clearOTP = (identifier: string): void => {
  otpStore.delete(identifier);
};

// Generate TOTP secret for MFA
export const generateTOTPSecret = (): string => {
  return crypto.randomBytes(32).toString('base64');
};

// Generate TOTP code (simplified version)
export const generateTOTP = (secret: string, window: number = 30): string => {
  const counter = Math.floor(Date.now() / 1000 / window);
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(Buffer.from(counter.toString(16).padStart(16, '0'), 'hex'));
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code = ((digest[offset] & 0x7f) << 24 |
                (digest[offset + 1] & 0xff) << 16 |
                (digest[offset + 2] & 0xff) << 8 |
                (digest[offset + 3] & 0xff)) % 1000000;
  return code.toString().padStart(6, '0');
};

export const verifyTOTP = (secret: string, token: string, window: number = 30, drift: number = 1): boolean => {
  for (let i = -drift; i <= drift; i++) {
    const expectedToken = generateTOTP(secret, window);
    if (expectedToken === token) {
      return true;
    }
  }
  return false;
};