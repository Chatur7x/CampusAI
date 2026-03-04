import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { authRateLimiter, apiRateLimiter } from '../middleware/rateLimiter';
import { upload } from '../middleware/upload';
import { loginValidation, registerValidation } from '../middleware/validation';

// Controllers
import * as authController from '../controllers/authController';
import * as attendanceController from '../controllers/attendanceController';
import * as noticeController from '../controllers/noticeController';
import * as leaveController from '../controllers/leaveController';
import * as analyticsController from '../controllers/analyticsController';
import * as timetableController from '../controllers/timetableController';
import * as bulkController from '../controllers/bulkController';
import * as adminController from '../controllers/adminController';
import * as blockchainController from '../controllers/blockchainController';
import * as chatController from '../controllers/chatController';

const router = Router();

// ==================== AUTH ROUTES ====================
router.post('/auth/login', authRateLimiter, loginValidation, authController.login);
router.post('/auth/verify-mfa', authRateLimiter, authController.verifyMFA);
router.post('/auth/register', authRateLimiter, registerValidation, authController.register);
router.post('/auth/refresh-token', authController.refreshToken);
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/setup-mfa', authenticate, authController.setupMFA);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/me', authenticate, authController.getMe);
router.get('/auth/role', authRateLimiter, authController.getRoleByEmail);

// ==================== ATTENDANCE ROUTES ====================
router.post('/attendance/face', authenticate, attendanceController.markAttendanceWithFace);
router.post('/attendance/manual', authenticate, requireRole('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'), attendanceController.markAttendanceManual);
router.post('/attendance/bulk', authenticate, requireRole('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'), attendanceController.markBulkAttendance);
router.get('/attendance/student/:studentId', authenticate, attendanceController.getStudentAttendance);
router.get('/attendance/class/:classId', authenticate, attendanceController.getClassAttendance);
router.get('/attendance/analytics/:studentId', authenticate, attendanceController.getAttendanceAnalytics);
router.post('/attendance/register-face', authenticate, attendanceController.registerFace);

// ==================== NOTICE ROUTES ====================
router.post('/notices', authenticate, requireRole('ADMIN', 'SUPER_ADMIN', 'FACULTY'), noticeController.createNotice);
router.get('/notices', authenticate, noticeController.getNotices);
router.get('/notices/:id', authenticate, noticeController.getNoticeById);
router.put('/notices/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), noticeController.updateNotice);
router.delete('/notices/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), noticeController.deleteNotice);
router.get('/notices/stats', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), noticeController.getNoticeStats);

// ==================== LEAVE ROUTES ====================
router.post('/leaves', authenticate, requireRole('STUDENT'), leaveController.createLeaveRequest);
router.get('/leaves/my', authenticate, requireRole('STUDENT'), leaveController.getMyLeaveRequests);
router.put('/leaves/:id/cancel', authenticate, requireRole('STUDENT'), leaveController.cancelLeaveRequest);
router.get('/leaves/pending', authenticate, requireRole('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'), leaveController.getPendingLeaveRequests);
router.put('/leaves/:id/approve', authenticate, requireRole('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'), leaveController.approveLeaveRequest);
router.get('/leaves/stats/:studentId', authenticate, leaveController.getLeaveStats);

// ==================== ANALYTICS ROUTES ====================
router.get('/analytics/admin-dashboard', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), analyticsController.getAdminDashboardStats);
router.get('/analytics/faculty-dashboard', authenticate, requireRole('FACULTY', 'CLASS_INCHARGE'), analyticsController.getFacultyDashboardStats);
router.get('/analytics/student-dashboard', authenticate, requireRole('STUDENT'), analyticsController.getStudentDashboardStats);
router.get('/analytics/predictions/:studentId', authenticate, analyticsController.getAttendancePredictions);
router.get('/analytics/department/:departmentId', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), analyticsController.getDepartmentAnalytics);

// ==================== TIMETABLE ROUTES ====================
router.post('/timetable', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), timetableController.createTimetableEntry);
router.get('/timetable', authenticate, timetableController.getTimetable);
router.get('/timetable/my', authenticate, timetableController.getMyTimetable);
router.put('/timetable/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), timetableController.updateTimetableEntry);
router.delete('/timetable/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), timetableController.deleteTimetableEntry);
router.post('/timetable/bulk', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), timetableController.bulkCreateTimetable);

// ==================== BULK OPERATIONS ROUTES ====================
router.post('/bulk/upload-students', 
  authenticate, 
  requireRole('ADMIN', 'SUPER_ADMIN'), 
  upload.single('csv'), 
  bulkController.uploadStudentsCSV
);
router.post('/bulk/upload-faculty', 
  authenticate, 
  requireRole('ADMIN', 'SUPER_ADMIN'), 
  upload.single('csv'), 
  bulkController.uploadFacultyCSV
);
router.get('/bulk/export-students', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), bulkController.exportStudents);
router.get('/bulk/export-attendance', authenticate, requireRole('ADMIN', 'SUPER_ADMIN', 'FACULTY'), bulkController.exportAttendance);
router.post('/bulk/attendance-correction', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), bulkController.bulkAttendanceCorrection);

// ==================== ADMIN ROUTES ====================
router.get('/admin/users', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.getAllUsers);
router.post('/admin/users', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.createUser);
router.put('/admin/users/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.updateUser);
router.delete('/admin/users/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.deleteUser);

router.get('/admin/departments', authenticate, adminController.getDepartments);
router.post('/admin/departments', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.createDepartment);
router.put('/admin/departments/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.updateDepartment);
router.delete('/admin/departments/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.deleteDepartment);

router.get('/admin/courses', authenticate, adminController.getCourses);
router.post('/admin/courses', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.createCourse);

router.get('/admin/classes', authenticate, adminController.getClasses);
router.post('/admin/classes', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.createClass);

router.get('/admin/settings', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.getSystemSettings);
router.put('/admin/settings/:key', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), adminController.updateSystemSetting);

// ==================== BLOCKCHAIN ROUTES ====================
router.get('/blockchain/status', authenticate, blockchainController.getBlockchainStatus);
router.get('/blockchain/verify/:attendanceId', authenticate, blockchainController.verifyAttendanceRecord);
router.get('/blockchain/block/:hash', authenticate, blockchainController.getBlockByHash);
router.get('/blockchain/audit', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), blockchainController.getBlockchainAudit);
router.get('/blockchain/attendance-chain/:studentId', authenticate, blockchainController.getAttendanceChain);

// ==================== CHAT ROUTES ====================
router.post('/chat/messages', authenticate, chatController.sendMessage);
router.get('/chat/conversations', authenticate, chatController.getConversations);
router.get('/chat/messages/:userId', authenticate, chatController.getMessages);
router.put('/chat/messages/read/:userId', authenticate, chatController.markMessagesAsRead);
router.delete('/chat/messages/:messageId', authenticate, chatController.deleteMessage);
router.get('/chat/class/:classId', authenticate, chatController.getClassChat);

export default router;