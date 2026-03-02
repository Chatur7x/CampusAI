import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

export const createRateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.ip || 'unknown';
    const now = Date.now();

    const entry = rateLimitStore.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    entry.count++;
    next();
  };
};

// Stricter rate limiter for auth endpoints
export const authRateLimiter = createRateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes

// General API rate limiter
export const apiRateLimiter = createRateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes

// File upload rate limiter
export const uploadRateLimiter = createRateLimiter(10, 60 * 60 * 1000); // 10 uploads per hour