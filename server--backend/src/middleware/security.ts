import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';

// ==================== CSRF PROTECTION ====================
// Double-submit cookie pattern: token in cookie must match header

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Generate a CSRF token for the client
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware: Set CSRF cookie on every response
 */
export function csrfCookieSetter(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,  // JS needs to read it to send in header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 3600 * 1000,
    });
  }
  next();
}

/**
 * Middleware: Validate CSRF token on state-changing requests (POST/PUT/DELETE)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  // Skip safe methods and auth endpoints (login doesn't have a cookie yet)
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    next();
    return;
  }

  // Skip CSRF for API-key-authenticated requests (mobile apps, etc.)
  if (req.headers['x-api-key']) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({
      success: false,
      message: 'CSRF token validation failed',
    });
    return;
  }

  next();
}

// ==================== API REQUEST LOGGING ====================

// In-memory buffer for batch DB writes (flush every 30s or 50 entries)
const LOG_BUFFER: Array<{
  userId: string | null;
  method: string;
  path: string;
  statusCode: number;
  ipAddress: string | undefined;
  userAgent: string | null;
  responseMs: number;
  flagged: boolean;
}> = [];
const LOG_FLUSH_INTERVAL = 30_000; // 30 seconds
const LOG_FLUSH_SIZE = 50;

function flushLogBuffer(): void {
  if (LOG_BUFFER.length === 0) return;
  const batch = LOG_BUFFER.splice(0, LOG_BUFFER.length);
  prisma.apiRequestLog.createMany({ data: batch })
    .catch(() => { /* silently ignore logging failures */ });
}

// Periodic flush
setInterval(flushLogBuffer, LOG_FLUSH_INTERVAL);

/**
 * Middleware: Log every API request for threat analysis (batched writes)
 */
export function apiRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const responseMs = Date.now() - start;
    const authReq = req as AuthenticatedRequest;

    LOG_BUFFER.push({
      userId: authReq.user?.id || null,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
      responseMs,
      flagged: isSuspiciousRequest(req, res),
    });

    // Flush if buffer is full
    if (LOG_BUFFER.length >= LOG_FLUSH_SIZE) {
      flushLogBuffer();
    }
  });

  next();
}

/**
 * Heuristic: flag requests that look suspicious
 */
function isSuspiciousRequest(req: Request, res: Response): boolean {
  // Multiple 401/403 responses
  if (res.statusCode === 401 || res.statusCode === 403) return true;
  // SQL injection patterns in query params
  const rawQuery = req.originalUrl;
  if (/('|--|;|union\s+select|drop\s+table)/i.test(rawQuery)) return true;
  // XSS patterns
  if (/<script|javascript:|on\w+=/i.test(rawQuery)) return true;
  return false;
}

// ==================== SECURITY HEADERS ====================

/**
 * Middleware: Add extra security headers beyond helmet defaults
 */
export function extraSecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers: rely on CSP instead
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  next();
}

// ==================== IP ALLOWLIST ====================

/**
 * Create an IP allowlist middleware for admin-only endpoints
 */
export function ipAllowlist(allowedIPs: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedIPs.length === 0) {
      // No allowlist configured — allow all
      next();
      return;
    }

    const clientIP = req.ip || req.socket.remoteAddress || '';
    if (allowedIPs.includes(clientIP)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: 'Access denied: IP not in allowlist',
    });
  };
}

// ==================== REQUEST SIZE VALIDATOR ====================

/**
 * Reject excessively large payloads (defense against slow POST attacks)
 */
export function maxPayloadSize(maxBytes: number = 5 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      res.status(413).json({
        success: false,
        message: `Payload too large. Maximum: ${Math.round(maxBytes / 1024 / 1024)}MB`,
      });
      return;
    }
    next();
  };
}
