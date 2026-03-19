import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { isTokenBlacklisted } from '../utils/tokenBlacklist';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      res.status(401).json({ success: false, message: 'Token not provided' });
      return;
    }

    if (await isTokenBlacklisted(token)) {
      res.status(401).json({ success: false, message: 'Token has been revoked' });
      return;
    }

    const decoded = verifyToken(token);

    // Profile holds role and is_active for app-level auth
    const profile = await prisma.profile.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, email: true, role: true, is_active: true },
    });

    if (!profile) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    if (!profile.is_active) {
      res.status(401).json({ success: false, message: 'Account is deactivated' });
      return;
    }

    req.user = {
      id: profile.user_id,
      email: profile.email,
      role: profile.role,
    };

    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
      return;
    }

    next();
  };
};

export const requireOwnershipOrRole = (
  paramName: string,
  ...allowedRoles: string[]
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    const resourceId = req.params[paramName];
    if (resourceId === req.user.id) {
      next();
      return;
    }

    res.status(403).json({ success: false, message: 'Access denied' });
  };
};
