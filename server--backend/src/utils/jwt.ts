import jwt, { SignOptions } from 'jsonwebtoken';
import { TokenPayload } from '../types';
import { env } from '../config/env';

const JWT_SECRET = env.jwtSecret;
const JWT_REFRESH_SECRET = env.jwtRefreshSecret;
const JWT_EXPIRES_IN = env.jwtExpiresIn;

// HS256 with a shared secret. Pinned on both sign and verify.
const ALG = 'HS256' as const;

// Validate secrets are strong enough at startup
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
if (JWT_REFRESH_SECRET.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
}

export const generateToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: ALG } as SignOptions);
};

export const generateRefreshToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d', algorithm: ALG } as SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
  // The algorithm is pinned rather than inferred from the token header, so a
  // token claiming `alg: none` — or any asymmetric algorithm the secret could
  // be misread as a public key for — is rejected before the signature is even
  // considered.
  return jwt.verify(token, JWT_SECRET, { algorithms: [ALG] }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: [ALG] }) as TokenPayload;
};

export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
};