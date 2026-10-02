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

// Role lookup for the caller's OWN profile only.
// Previously this accepted any ?email= and was unauthenticated, which let an
// attacker enumerate every account's email, role, MFA status and active state
// without ever authenticating. It is now scoped to the authenticated user.
export const getRoleByEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const email = (req.query.email as string | undefined)?.toLowerCase();
    const self = await prisma.profile.findUnique({
      where: { user_id: req.user!.id },
      select: { email: true, role: true, mfa_enabled: true, is_active: true },
    });

    // Only ever answer for the caller's own account. Anything else is reported
    // identically to an unknown email so the response can't be used as an oracle.
    if (!self || (email && email !== self.email.toLowerCase())) {
      res.status(200).json({ success: true, data: { exists: false } });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        exists: true,
        role: self.role,
        mfa_enabled: self.mfa_enabled,
        is_active: self.is_active,
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
    const ip_address = req.ip;
    const user_agent = req.headers['user-agent'] || '';

    // Check for brute force from this IP
    await detectBruteForce(ip_address || '', undefined);

    // Find user via auth.users (has encrypted_password)
    const authUser = await prisma.users.findFirst({
      where: { email },
    });

    if (!authUser) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Fetch profile for app-level fields
    const profile = await prisma.profile.findUnique({
      where: { user_id: authUser.id },
      include: {
        users: {
          include: {
            students: { include: { departments: true, classes: true } },
            faculty: { include: { departments_faculty_department_idTodepartments: true } },
            admins: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Check if account is locked
    if (profile.lockout_until && profile.lockout_until > new Date()) {
      const minutesLeft = Math.ceil((profile.lockout_until.getTime() - Date.now()) / 60000);
      await logLogin({ user_id: authUser.id, ip_address, user_agent, status: 'locked' });
      res.status(401).json({
        success: false,
        message: `Account locked. Try again in ${minutesLeft} minutes.`,
      });
      return;
    }

    // Verify password against encrypted_password on auth.users
    const isValidPassword = await comparePassword(password, authUser.encrypted_password || '');
    if (!isValidPassword) {
      const attempts = (profile.login_attempts || 0) + 1;
      const lockout_until = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

      await prisma.profile.update({
        where: { user_id: authUser.id },
        data: { login_attempts: attempts, lockout_until },
      });

      await logLogin({
        user_id: authUser.id, ip_address, user_agent,
        status: 'failed', failure_reason: 'wrong_password',
      });

      await detectBruteForce(ip_address || '', authUser.id);

      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Reset login attempts
    await prisma.profile.update({
      where: { user_id: authUser.id },
      data: { login_attempts: 0, lockout_until: null, last_login_at: new Date() },
    });

    // Register/update device fingerprint
    const deviceFingerprint = req.body.deviceFingerprint;
    if (deviceFingerprint) {
      const device_hash = generateDeviceHash(deviceFingerprint);
      const { isNew } = await registerDevice(authUser.id, device_hash, {
        ...deviceFingerprint,
        user_agent,
      }, ip_address);

      if (isNew) {
        const { browser, os } = parseUserAgent(user_agent);
        await createSecurityEvent({
          event_type: 'device_mismatch',
          severity: 'MEDIUM',
          user_id: authUser.id,
          ip_address,
          user_agent,
          description: `New device detected: ${browser} on ${os}`,
          data: { deviceFingerprint },
        });
      }
    }

    // Check if MFA is required
    if (profile.mfa_enabled) {
      const otp = generateOTP();
      storeOTP(authUser.id, otp, 10);
      await sendOTP(email, otp);
      await logLogin({ user_id: authUser.id, ip_address, user_agent, status: 'mfa_required' });

      res.status(200).json({
        success: true,
        message: 'MFA required',
        requireMFA: true,
        userId: authUser.id,
      });
      return;
    }

    // Generate tokens — use camelCase userId to match TokenPayload interface
    const tokenPayload = { userId: authUser.id, email: authUser.email!, role: profile.role };
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create session
    await prisma.session.create({
      data: {
        user_id: authUser.id,
        token: refreshToken,
        device_info: user_agent,
        ip_address: ip_address as any,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await logLogin({ user_id: authUser.id, ip_address, user_agent, status: 'success' });

    await logAction({
      userId: authUser.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: authUser.id,
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: authUser.id,
          email: authUser.email,
          role: profile.role,
          profile,
          student: profile.users.students,
          faculty: profile.users.faculty,
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

    const authUser = await prisma.users.findUnique({ where: { id: userId } });
    if (!authUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
      include: {
        users: {
          include: {
            students: { include: { departments: true, classes: true } },
            faculty: { include: { departments_faculty_department_idTodepartments: true } },
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    const tokenPayload = { userId: authUser.id, email: authUser.email!, role: profile.role };
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.session.create({
      data: {
        user_id: authUser.id,
        token: refreshToken,
        device_info: req.headers['user-agent'],
        ip_address: req.ip as any,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(200).json({
      success: true,
      message: 'MFA verification successful',
      data: {
        user: {
          id: authUser.id,
          email: authUser.email,
          role: profile.role,
          profile,
          student: profile.users.students,
          faculty: profile.users.faculty,
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
    const { email, password, first_name, last_name, role, departmentId, enrollmentId, employeeId } = req.body as RegisterRequest;

    // Open registration creates STUDENTS only. Staff/admin accounts are
    // provisioned out-of-band — never trust a client-supplied role.
    if (role !== 'STUDENT') {
      res.status(403).json({ success: false, message: 'Self-registration is open for students only' });
      return;
    }

    // Check if email exists on profiles
    const existingProfile = await prisma.profile.findUnique({ where: { email } });
    if (existingProfile) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.$transaction(async (tx) => {
      // Create auth.users entry
      const authUser = await tx.users.create({
        data: {
          id: crypto.randomUUID(),
          email,
          encrypted_password: hashedPassword,
          email_confirmed_at: new Date(),
        },
      });

      // Create profile with app-level fields
      await tx.profile.create({
        data: {
          user_id: authUser.id,
          email,
          first_name,
          last_name,
          role,
        },
      });

      if (role === 'STUDENT') {
        await tx.student.create({
          data: {
            user_id: authUser.id,
            enrollment_id: enrollmentId || `STU${Date.now()}`,
            department_id: departmentId || '',
            class_id: '',
            batch_year: new Date().getFullYear(),
            semester: 1,
          },
        });
      } else if (role === 'FACULTY' || role === 'CLASS_INCHARGE') {
        await tx.faculty.create({
          data: {
            user_id: authUser.id,
            employee_id: employeeId || `EMP${Date.now()}`,
            designation: 'Assistant Professor',
            department_id: departmentId || '',
            joining_date: new Date(),
          },
        });
      } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        await tx.admin.create({
          data: {
            user_id: authUser.id,
            permissions: [],
          },
        });
      }

      return authUser;
    });

    const otp = generateOTP();
    storeOTP(newUser.id, otp, 10);
    await sendOTP(email, otp);

    await logAction({
      userId: newUser.id,
      action: 'REGISTER',
      entityType: 'user',
      entityId: newUser.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: { userId: newUser.id },
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
      include: { users: true },
    });

    if (!session || session.expires_at < new Date()) {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      return;
    }

    if (session.user_id !== payload.userId) {
      res.status(401).json({ success: false, message: 'Token user mismatch' });
      return;
    }

    const profile = await prisma.profile.findUnique({ where: { user_id: session.user_id } });

    const tokenPayload = {
      userId: session.users.id,
      email: session.users.email!,
      role: profile?.role || 'STUDENT',
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

    // Store MFA secret in profile (not auth.users)
    // For now store in raw_user_meta_data on auth.users since Profile doesn't have mfa_secret
    await prisma.users.update({
      where: { id: req.user.id },
      data: {
        raw_user_meta_data: { mfa_secret: secret, backup_codes: backupCodes },
      },
    });

    res.status(200).json({
      success: true,
      data: { secret, backupCodes },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const profile = await prisma.profile.findUnique({ where: { email } });
    if (!profile) {
      res.status(200).json({ success: true, message: 'If the email exists, a reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(48).toString('hex');
    const expires_at = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.passwordReset.deleteMany({ where: { user_id: profile.user_id } });
      await tx.passwordReset.create({
        data: {
          user_id: profile.user_id,
          token: resetToken,
          expires_at,
        },
      });
    });

    await sendPasswordReset(email, resetToken);

    await logAction({
      userId: profile.user_id,
      action: 'REQUEST_PASSWORD_RESET',
      entityType: 'user',
      entityId: profile.user_id,
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

    if (!reset || reset.used_at || reset.expires_at < new Date()) {
      res.status(400).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      // Update password on auth.users
      await tx.users.update({
        where: { id: reset.user_id },
        data: { encrypted_password: hashedPassword },
      });

      // Reset lockout on profile
      await tx.profile.update({
        where: { user_id: reset.user_id },
        data: { login_attempts: 0, lockout_until: null },
      });

      await tx.session.deleteMany({ where: { user_id: reset.user_id } });
      await tx.passwordReset.update({
        where: { id: reset.id },
        data: { used_at: new Date() },
      });
    });

    await blacklistAllUserTokens(reset.user_id, 'password_change');

    await logAction({
      userId: reset.user_id,
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: reset.user_id,
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

    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
      include: {
        users: {
          include: {
            students: { include: { departments: true, classes: true } },
            faculty: { include: { departments_faculty_department_idTodepartments: true } },
            admins: true,
            notifications: {
              where: { is_read: false },
              take: 5,
              orderBy: { created_at: 'desc' },
            },
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        email: profile.email,
        role: profile.role,
        profile,
        student: profile.users.students,
        faculty: profile.users.faculty,
        admin: profile.users.admins,
        unreadNotifications: profile.users.notifications.length,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
