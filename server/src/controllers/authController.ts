import { Response } from 'express';
import { AuthenticatedRequest, LoginRequest, RegisterRequest } from '../types';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword, generateBackupCodes } from '../utils/bcrypt';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { generateOTP, storeOTP, verifyOTP, generateTOTPSecret } from '../utils/otp';
import { sendOTP, sendPasswordReset } from '../utils/email';
import { logAction } from '../utils/audit';
import crypto from 'crypto';

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as LoginRequest;

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
        data: {
          loginAttempts: attempts,
          lockoutUntil,
        },
      });

      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Reset login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Check if MFA is required
    if (user.mfaEnabled) {
      const otp = generateOTP();
      storeOTP(user.id, otp, 10);
      await sendOTP(email, otp);

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
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Log action
    await logAction({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
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

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
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

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Store reset token in a separate field or use a password reset table
        // For simplicity, we'll use the mfaSecret field temporarily
        mfaSecret: resetToken,
      },
    });

    await sendPasswordReset(email, resetToken);

    res.status(200).json({ success: true, message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
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