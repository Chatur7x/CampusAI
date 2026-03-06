import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest, LoginRequest, RegisterRequest } from '../types';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword, generateBackupCodes } from '../utils/bcrypt';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { generateOTP, storeOTP, verifyOTP, generateTOTPSecret } from '../utils/otp';
import { sendOTP, sendPasswordReset } from '../utils/email';
import { logAction } from '../utils/audit';
import { logLogin } from '../utils/loginHistory';
import { registerDevice, generateDeviceHash, parseUserAgent } from '../utils/deviceTrust';
import { detectBruteForce, createSecurityEvent } from '../utils/securityEvents';
import { blacklistToken, blacklistAllUserTokens } from '../utils/tokenBlacklist';

// Lightweight role lookup for login UI hints
export const getRoleByEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const email = (req.query.email as string | undefined)?.toLowerCase();
    if (!email || !email.includes('@')) {
      res.status(400).json({ success: false, message: 'Email query parameter required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true, mfaEnabled: true, isActive: true },
    });

    if (!user) {
      res.status(200).json({ success: true, data: { exists: false } });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        exists: true,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Role lookup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as LoginRequest;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    // Check for brute force from this IP
    await detectBruteForce(ipAddress || '', undefined);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        student: { include: { department: true, class: true } },
        faculty: { include: { department: true } },
        admin: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Check if account is locked
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      await logLogin({ userId: user.id, ipAddress, userAgent, status: 'locked' });
      res.status(401).json({
        success: false,
        message: `Account locked. Try again in ${minutesLeft} minutes.`,
      });
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      // Increment login attempts
      const attempts = user.loginAttempts + 1;
      const lockoutUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockoutUntil },
      });

      await logLogin({
        userId: user.id, ipAddress, userAgent,
        status: 'failed', failureReason: 'wrong_password',
      });

      // Check brute force for this specific user
      await detectBruteForce(ipAddress || '', user.id);

      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Reset login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date() },
    });

    // Register/update device fingerprint
    const deviceFingerprint = req.body.deviceFingerprint;
    if (deviceFingerprint) {
      const deviceHash = generateDeviceHash(deviceFingerprint);
      const { isNew } = await registerDevice(user.id, deviceHash, {
        ...deviceFingerprint,
        userAgent,
      }, ipAddress);

      // New device → security event
      if (isNew) {
        const { browser, os } = parseUserAgent(userAgent);
        await createSecurityEvent({
          eventType: 'device_mismatch',
          severity: 'MEDIUM',
          userId: user.id,
          ipAddress,
          userAgent,
          description: `New device detected: ${browser} on ${os}`,
          metadata: { deviceFingerprint },
        });
      }
    }

    // Check if MFA is required
    if (user.mfaEnabled) {
      const otp = generateOTP();
      storeOTP(user.id, otp, 10);
      await sendOTP(email, otp);
      await logLogin({ userId: user.id, ipAddress, userAgent, status: 'mfa_required' });

      res.status(200).json({
        success: true,
        message: 'MFA required',
        requireMFA: true,
        userId: user.id,
      });
      return;
    }

    // Generate tokens
    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        deviceInfo: userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Log successful login
    await logLogin({ userId: user.id, ipAddress, userAgent, status: 'success' });

    // Log action
    await logAction({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          student: user.student,
          faculty: user.faculty,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const verifyMFA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, otp } = req.body;

    if (!verifyOTP(userId, otp)) {
      res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        student: { include: { department: true, class: true } },
        faculty: { include: { department: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(200).json({
      success: true,
      message: 'MFA verification successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          student: user.student,
          faculty: user.faculty,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role, departmentId, enrollmentId, employeeId } = req.body as RegisterRequest;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with profile
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
        },
      });

      await tx.profile.create({
        data: {
          userId: newUser.id,
          firstName,
          lastName,
        },
      });

      // Create role-specific records
      if (role === 'STUDENT') {
        await tx.student.create({
          data: {
            userId: newUser.id,
            enrollmentId: enrollmentId || `STU${Date.now()}`,
            departmentId: departmentId || '',
            classId: '',
            batchYear: new Date().getFullYear(),
            semester: 1,
          },
        });
      } else if (role === 'FACULTY' || role === 'CLASS_INCHARGE') {
        await tx.faculty.create({
          data: {
            userId: newUser.id,
            employeeId: employeeId || `EMP${Date.now()}`,
            designation: 'Assistant Professor',
            departmentId: departmentId || '',
            joiningDate: new Date(),
          },
        });
      } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        await tx.admin.create({
          data: {
            userId: newUser.id,
            permissions: [],
          },
        });
      }

      return newUser;
    });

    // Generate verification OTP
    const otp = generateOTP();
    storeOTP(user.id, otp, 10);
    await sendOTP(email, otp);

    await logAction({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: { userId: user.id },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const refreshToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: 'Refresh token is required' });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      console.error('Refresh token verification failed:', err);
      res.status(401).json({ success: false, message: 'Invalid or malformed refresh token' });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      return;
    }

    if (session.userId !== payload.userId) {
      res.status(401).json({ success: false, message: 'Token user mismatch' });
      return;
    }

    const tokenPayload = {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
    };

    const accessToken = generateToken(tokenPayload);

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    // Blacklist the current access token so it can't be reused
    const accessToken = req.headers.authorization?.substring(7);
    if (accessToken && req.user) {
      await blacklistToken(accessToken, req.user.id, 'logout');
    }

    await prisma.session.deleteMany({ where: { token } });

    if (req.user) {
      await logAction({
        userId: req.user.id,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const setupMFA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const secret = generateTOTPSecret();
    const backupCodes = generateBackupCodes();

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        mfaSecret: secret,
        backupCodes,
        mfaEnabled: false, // Will be enabled after verification
      },
    });

    res.status(200).json({
      success: true,
      data: {
        secret,
        backupCodes,
      },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      res.status(200).json({ success: true, message: 'If the email exists, a reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.$transaction(async (tx) => {
      await tx.passwordReset.deleteMany({ where: { userId: user.id } });
      await tx.passwordReset.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt,
        },
      });
    });

    await sendPasswordReset(email, resetToken);

    await logAction({
      userId: user.id,
      action: 'REQUEST_PASSWORD_RESET',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ success: false, message: 'Token and newPassword are required' });
      return;
    }

    const reset = await prisma.passwordReset.findUnique({ where: { token } });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      res.status(400).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: reset.userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: reset.userId },
        data: {
          password: hashedPassword,
          loginAttempts: 0,
          lockoutUntil: null,
        },
      });

      await tx.session.deleteMany({ where: { userId: reset.userId } });
      await tx.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      });
    });

    // Revoke all existing tokens for this user
    await blacklistAllUserTokens(reset.userId, 'password_change');

    await logAction({
      userId: reset.userId,
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: reset.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'Password reset successful. Please log in again.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        student: { include: { department: true, class: true } },
        faculty: { include: { department: true } },
        admin: true,
        notifications: {
          where: { isRead: false },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        student: user.student,
        faculty: user.faculty,
        admin: user.admin,
        unreadNotifications: user.notifications.length,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};