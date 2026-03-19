import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';
import { hashPassword } from '../utils/bcrypt';

// ==================== USER MANAGEMENT ====================
export const getAllUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const where: any = {};
    if (role) where.role = role;

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { profiles: { first_name: { contains: search as string, mode: 'insensitive' } } },
        { profiles: { last_name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        include: {
          profiles: {
            select: {
              first_name: true,
              last_name: true,
              phone: true,
              avatar_url: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.users.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, first_name, last_name, role, ...roleData } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    // Email lives on profiles table — check via profile
    const existingProfile = await prisma.profile.findUnique({ where: { email } });
    if (existingProfile) {
      res.status(409).json({ success: false, message: 'Email already exists' });
      return;
    }

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          id: crypto.randomUUID(),
          email,
          encrypted_password: await hashPassword(password),
          email_confirmed_at: new Date(),
        },
      });

      await tx.profile.create({
        data: {
          user_id: newUser.id,
          email,
          first_name,
          last_name,
          role,
        },
      });

      if (role === 'STUDENT') {
        await tx.student.create({
          data: {
            user_id: newUser.id,
            enrollment_id: roleData.enrollmentId || `STU${Date.now()}`,
            department_id: roleData.departmentId || '',
            class_id: roleData.classId || '',
            batch_year: roleData.batchYear || new Date().getFullYear(),
            semester: roleData.semester || 1,
          },
        });
      } else if (role === 'FACULTY' || role === 'CLASS_INCHARGE') {
        await tx.faculty.create({
          data: {
            user_id: newUser.id,
            employee_id: roleData.employeeId || `EMP${Date.now()}`,
            designation: roleData.designation || 'Assistant Professor',
            department_id: roleData.departmentId || '',
            joining_date: new Date(),
          },
        });
      } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        await tx.admin.create({
          data: {
            user_id: newUser.id,
            permissions: roleData.permissions || [],
          },
        });
      }

      return newUser;
    });

    await logAction({
      userId: req.user.id,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: user.id,
      newValue: { email, role, first_name, last_name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: user.id, email, role },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { first_name, last_name, is_active, role } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingUser = await prisma.users.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = await prisma.$transaction(async (tx) => {
      // is_active lives on profiles, role lives on users
      const updated = await tx.users.update({
        where: { id },
        data: { role: role || existingUser.role },
      });

      await tx.profile.update({
        where: { user_id: id },
        data: {
          ...(first_name && { first_name }),
          ...(last_name && { last_name }),
          ...(is_active !== undefined && { is_active }),
          ...(role && { role }),
        },
      });

      return updated;
    });

    await logAction({
      userId: req.user.id,
      action: 'UPDATE_USER',
      entityType: 'user',
      entityId: id,
      oldValue: existingUser,
      newValue: user,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingUser = await prisma.users.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Soft delete — deactivate on profile
    await prisma.profile.update({
      where: { user_id: id },
      data: { is_active: false },
    });

    await logAction({
      userId: req.user.id,
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: id,
      oldValue: existingUser,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== DEPARTMENT MANAGEMENT ====================
export const getDepartments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            students: true,
            faculty_faculty_department_idTodepartments: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, hod_id } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const department = await prisma.department.create({
      data: { name, code, description, hod_id },
    });

    await logAction({
      userId: req.user.id,
      action: 'CREATE_DEPARTMENT',
      entityType: 'department',
      entityId: department.id,
      newValue: department,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'Department created successfully', data: department });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, hod_id } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingDepartment = await prisma.department.findUnique({ where: { id } });
    if (!existingDepartment) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const department = await prisma.department.update({
      where: { id },
      data: { name, description, hod_id },
    });

    await logAction({
      userId: req.user.id,
      action: 'UPDATE_DEPARTMENT',
      entityType: 'department',
      entityId: id,
      oldValue: existingDepartment,
      newValue: department,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'Department updated successfully', data: department });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingDepartment = await prisma.department.findUnique({ where: { id } });
    if (!existingDepartment) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    await prisma.department.delete({ where: { id } });

    await logAction({
      userId: req.user.id,
      action: 'DELETE_DEPARTMENT',
      entityType: 'department',
      entityId: id,
      oldValue: existingDepartment,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== COURSE MANAGEMENT ====================
export const getCourses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { department_id } = req.query;

    const where: any = {};
    if (department_id) where.department_id = department_id as string;

    const courses = await prisma.course.findMany({
      where,
      include: {
        departments: true,
        _count: { select: { subjects: true, classes: true } },
      },
    });

    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, code, credits, semester, department_id, description } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const course = await prisma.course.create({
      data: { name, code, credits, semester, department_id, description },
    });

    await logAction({
      userId: req.user.id,
      action: 'CREATE_COURSE',
      entityType: 'course',
      entityId: course.id,
      newValue: course,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'Course created successfully', data: course });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== CLASS MANAGEMENT ====================
export const getClasses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        departments: true,
        courses: true,
        faculty: {
          include: {
            users: { include: { profiles: true } },
          },
        },
        _count: { select: { students: true } },
      },
    });

    res.status(200).json({ success: true, data: classes });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createClass = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, section, department_id, course_id, incharge_id, room_number, capacity, academic_year } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const cls = await prisma.class.create({
      data: { name, section, department_id, course_id, incharge_id, room_number, capacity, academic_year },
    });

    await logAction({
      userId: req.user.id,
      action: 'CREATE_CLASS',
      entityType: 'class',
      entityId: cls.id,
      newValue: cls,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'Class created successfully', data: cls });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== SYSTEM SETTINGS ====================
export const getSystemSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSetting.findMany();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateSystemSetting = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value, updated_by: req.user.id },
      create: { key, value, updated_by: req.user.id },
    });

    await logAction({
      userId: req.user.id,
      action: 'UPDATE_SYSTEM_SETTING',
      entityType: 'setting',
      entityId: key,
      newValue: setting,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'Setting updated successfully', data: setting });
  } catch (error) {
    console.error('Update system setting error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
