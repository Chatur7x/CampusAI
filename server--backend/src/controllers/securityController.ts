import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { getSecurityEvents, resolveSecurityEvent, getSecurityStats } from '../utils/securityEvents';
import { getUserDevices, setDeviceTrust, removeDevice } from '../utils/deviceTrust';
import { getLoginHistory, getAllLoginHistory } from '../utils/loginHistory';
import { getGeoHistory } from '../utils/geoVerification';
import { cleanupExpiredTokens } from '../utils/tokenBlacklist';
import { prisma } from '../utils/prisma';
import { severity } from '@prisma/client';

// ==================== SECURITY DASHBOARD ====================
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const stats = await getSecurityStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Security stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== SECURITY EVENTS ====================
export const listSecurityEvents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const { eventType, severity: sev, userId, resolved, startDate, endDate, page, limit } = req.query;
    const data = await getSecurityEvents({
      eventType: eventType as string | undefined,
      severity: sev as severity | undefined,
      userId: userId as string | undefined,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('List security events error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const resolveEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const { id } = req.params;
    await resolveSecurityEvent(id, req.user.id);
    res.json({ success: true, message: 'Event resolved' });
  } catch (error) {
    console.error('Resolve event error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== DEVICE TRUST ====================
export const listDevices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const userId = (req.query.userId as string) || req.user.id;
    if (userId !== req.user.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    const devices = await getUserDevices(userId);
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const trustDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const { deviceId } = req.params;
    const { trusted, ttlDays } = req.body;
    await setDeviceTrust(deviceId, req.user.id, trusted ?? true, ttlDays ?? 90);
    res.json({ success: true, message: `Device ${trusted ? 'trusted' : 'untrusted'}` });
  } catch (error) {
    console.error('Trust device error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const { deviceId } = req.params;
    await removeDevice(deviceId, req.user.id);
    res.json({ success: true, message: 'Device removed' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== LOGIN HISTORY ====================
export const myLoginHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const logs = await getLoginHistory(req.user.id, limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('My login history error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const allLoginHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const { userId, status, startDate, endDate, page, limit } = req.query;
    const data = await getAllLoginHistory({
      userId: userId as string | undefined,
      status: status as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('All login history error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== GEO VERIFICATION ====================
export const geoHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const userId = (req.query.userId as string) || req.user.id;
    if (userId !== req.user.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const data = await getGeoHistory(userId, limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Geo history error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== TOKEN MANAGEMENT ====================
export const cleanupTokens = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const count = await cleanupExpiredTokens();
    res.json({ success: true, data: { cleanedUp: count } });
  } catch (error) {
    console.error('Cleanup tokens error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== ACTIVE SESSIONS ====================
export const listActiveSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const sessions = await prisma.session.findMany({
      where: { user_id: req.user.id, expires_at: { gt: new Date() } },
      select: { id: true, device_info: true, ip_address: true, created_at: true, expires_at: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const revokeSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const { sessionId } = req.params;
    await prisma.session.deleteMany({ where: { id: sessionId, user_id: req.user.id } });
    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const revokeAllSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Auth required' }); return; }
    const { keepCurrent } = req.body;

    if (keepCurrent) {
      const currentSession = await prisma.session.findFirst({
        where: { user_id: req.user.id },
        orderBy: { created_at: 'desc' },
      });
      if (currentSession) {
        await prisma.session.deleteMany({
          where: { user_id: req.user.id, id: { not: currentSession.id } },
        });
      }
    } else {
      await prisma.session.deleteMany({ where: { user_id: req.user.id } });
    }

    res.json({ success: true, message: 'All other sessions revoked' });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
