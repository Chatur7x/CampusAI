import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';

// ==================== DASHBOARD ANALYTICS ====================
export const getAdminDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      totalStudents,
      totalFaculty,
      totalDepartments,
      todayAttendance,
      recentAlerts,
      pendingLeaves,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.faculty.count(),
      prisma.department.count(),
      getTodayAttendanceStats(),
      prisma.securityAlert.count({ where: { resolved: false } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
    ]);

    // Monthly attendance trend
    const monthlyTrend = await getMonthlyAttendanceTrend();

    // Department-wise stats
    const departmentStats = await getDepartmentStats();

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalFaculty,
          totalDepartments,
          todayAttendance,
          recentAlerts,
          pendingLeaves,
        },
        monthlyTrend,
        departmentStats,
      },
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getFacultyDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const faculty = await prisma.faculty.findUnique({
      where: { userId: req.user.id },
    });

    if (!faculty) {
      res.status(404).json({ success: false, message: 'Faculty record not found' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      myClasses,
      todaySchedule,
      totalStudents,
      pendingLeaves,
    ] = await Promise.all([
      prisma.class.count({ where: { inchargeId: faculty.id } }),
      prisma.timetableEntry.count({
        where: {
          facultyId: faculty.id,
          dayOfWeek: today.getDay(),
        },
      }),
      prisma.student.count({
        where: {
          class: { inchargeId: faculty.id },
        },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'PENDING',
          student: {
            class: { inchargeId: faculty.id },
          },
        },
      }),
    ]);

    // Class performance
    const classPerformance = await getClassPerformance(faculty.id);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          myClasses,
          todaySchedule,
          totalStudents,
          pendingLeaves,
        },
        classPerformance,
      },
    });
  } catch (error) {
    console.error('Faculty dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getStudentDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      include: {
        attendance: {
          orderBy: { date: 'desc' },
        },
        class: {
          include: {
            timetable: {
              where: { isActive: true },
              include: { subject: true },
            }
          }
        },
      },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' });
      return;
    }

    // 1. Fetch Session Weights from System Settings
    const weightsSetting = await prisma.systemSetting.findUnique({
      where: { key: 'attendance_weights' }
    });
    
    const weights: Record<string, number> = (weightsSetting?.value as any) || {
      CLASS: 1,
      LAB: 2
    };

    // 2. Calculate Weighted Attendance Stats
    let totalWeightedSessions = 0;
    let attendedWeightedSessions = 0;
    let totalClasses = 0;
    let totalLabs = 0;
    let attendedClasses = 0;
    let attendedLabs = 0;

    const subjectBreakdown: Record<string, { 
      name: string; 
      total: number; 
      attended: number; 
      percentage: number;
    }> = {};

    student.attendance.forEach(att => {
      const type = att.session_type || 'CLASS';
      const weight = weights[type] || 1;
      const isPresent = att.status === 'PRESENT' || att.status === 'EXCUSED';
      const isLate = att.status === 'LATE';
      
      const sessionValue = isPresent ? 1 : (isLate ? 0.75 : 0);
      
      totalWeightedSessions += weight;
      attendedWeightedSessions += (sessionValue * weight);

      if (type === 'LAB') {
        totalLabs++;
        if (isPresent) attendedLabs++;
      } else {
        totalClasses++;
        if (isPresent) attendedClasses++;
      }

      // Subject breakdown
      if (att.subject_id) {
        if (!subjectBreakdown[att.subject_id]) {
          subjectBreakdown[att.subject_id] = { name: 'Unknown', total: 0, attended: 0, percentage: 0 };
        }
        subjectBreakdown[att.subject_id].total += weight;
        subjectBreakdown[att.subject_id].attended += (sessionValue * weight);
      }
    });

    // Resolve subject names
    const subjectIds = Object.keys(subjectBreakdown);
    if (subjectIds.length > 0) {
      const subjects = await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true }
      });
      subjects.forEach(s => {
        if (subjectBreakdown[s.id]) subjectBreakdown[s.id].name = s.name;
      });
    }

    Object.values(subjectBreakdown).forEach(s => {
      s.percentage = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
    });

    const overallPercentage = totalWeightedSessions > 0 
      ? Math.round((attendedWeightedSessions / totalWeightedSessions) * 100) 
      : 0;

    // 3. Smart Calculator Logic (S5, S6)
    const target = 75;
    const currentDeficit = Math.max(0, (target / 100) * totalWeightedSessions - attendedWeightedSessions);
    
    // Recovery Strategies
    const labsOnlyNeeded = Math.ceil(currentDeficit / (weights.LAB * (1 - target/100)));
    const classesOnlyNeeded = Math.ceil(currentDeficit / (weights.CLASS * (1 - target/100)));
    
    // 4. Today's Timetable
    const today = new Date();
    const todayDay = today.getDay();
    const schedule = student.class.timetable.filter(t => t.dayOfWeek === todayDay);

    // 5. Recent Notices
    const notices = await prisma.notice.findMany({
      where: {
        isActive: true,
        OR: [
          { targetRoles: { has: 'STUDENT' } },
          { targetClasses: { has: student.classId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // 6. AI Metrics (S3)
    const riskScore = calculateRiskScore(student.attendance);
    const stabilityIndex = Math.max(0, 100 - riskScore);
    const projectedOutcome = overallPercentage > 75 ? 'FAVORABLE' : (overallPercentage > 60 ? 'CAUTIONARY' : 'CRITICAL');

    res.status(200).json({
      success: true,
      data: {
        summary: {
          attendancePercentage: overallPercentage,
          totalWeightedSessions,
          attendedWeightedSessions: Math.round(attendedWeightedSessions * 100) / 100,
          totalClasses,
          attendedClasses,
          totalLabs,
          attendedLabs,
          riskLevel: overallPercentage < 60 ? 'HIGH' : (overallPercentage < 75 ? 'MEDIUM' : 'LOW'),
          status: overallPercentage >= 75 ? 'SAFE' : 'SHORTAGE',
          stabilityIndex,
          riskScore,
          projectedOutcome
        },
        subjectBreakdown: Object.values(subjectBreakdown),
        calculator: {
          target,
          currentDeficit,
          strategies: {
            combined: {
              label: 'Fastest Recovery (Labs + classes)',
              sessions: Math.ceil(currentDeficit / ((weights.LAB + weights.CLASS)/2 * (1 - target/100))),
            },
            labsOnly: {
              label: 'Lab Focused (Highest Weight)',
              sessions: labsOnlyNeeded,
              impactPerSession: weights.LAB,
            },
            classesOnly: {
              label: 'Class Focused',
              sessions: classesOnlyNeeded,
              impactPerSession: weights.CLASS,
            }
          }
        },
        timetable: schedule.map(s => ({
          subject: s.subject.name,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.roomNumber || student.class.roomNumber,
          type: s.sessionType
        })),
        notices: notices.map(n => ({
          id: n.id,
          title: n.title,
          priority: n.priority,
          createdAt: n.createdAt
        }))
      },
    });
  } catch (error) {
    console.error('Student dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== ADVANCED ANALYTICS ====================
export const getAttendancePredictions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { attendance: true },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const attendance = student.attendance;
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'PRESENT').length;
    const currentPercentage = total > 0 ? (present / total) * 100 : 0;

    // Simple linear regression for prediction
    const sortedAttendance = attendance
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((a, i) => ({ day: i, present: a.status === 'PRESENT' ? 1 : 0 }));

    // Calculate trend
    const n = sortedAttendance.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const point of sortedAttendance) {
      sumX += point.day;
      sumY += point.present;
      sumXY += point.day * point.present;
      sumX2 += point.day * point.day;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n || 0;

    // Predict next 30 days
    const predictions = [];
    for (let i = 1; i <= 30; i++) {
      const predictedValue = slope * (n + i) + intercept;
      predictions.push({
        day: n + i,
        predictedAttendance: Math.max(0, Math.min(1, predictedValue)),
      });
    }

    // Risk scoring
    const riskScore = calculateRiskScore(attendance);

    res.status(200).json({
      success: true,
      data: {
        currentPercentage: Math.round(currentPercentage * 100) / 100,
        trend: slope > 0 ? 'IMPROVING' : slope < 0 ? 'DECLINING' : 'STABLE',
        slope: Math.round(slope * 1000) / 1000,
        predictions,
        riskScore,
        recommendations: generateRecommendations(currentPercentage, riskScore),
      },
    });
  } catch (error) {
    console.error('Attendance predictions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getDepartmentAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { departmentId } = req.params;

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        students: { include: { attendance: true } },
        faculty: true,
      },
    });

    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    // Calculate department-wide attendance
    let totalAttendance = 0;
    let totalPresent = 0;
    const atRiskStudents = [];
    const topPerformers = [];

    for (const student of department.students) {
      const total = student.attendance.length;
      const present = student.attendance.filter(a => a.status === 'PRESENT').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      totalAttendance += total;
      totalPresent += present;

      if (percentage < 60) {
        atRiskStudents.push({ studentId: student.id, percentage });
      } else if (percentage > 90) {
        topPerformers.push({ studentId: student.id, percentage });
      }
    }

    const averageAttendance = totalAttendance > 0 ? (totalPresent / totalAttendance) * 100 : 0;

    // Weekly trend
    const weeklyTrend = await getWeeklyTrend(departmentId);

    res.status(200).json({
      success: true,
      data: {
        departmentName: department.name,
        totalStudents: department.students.length,
        totalFaculty: department.faculty.length,
        averageAttendance: Math.round(averageAttendance * 100) / 100,
        atRiskStudents: atRiskStudents.sort((a, b) => a.percentage - b.percentage).slice(0, 10),
        topPerformers: topPerformers.sort((a, b) => b.percentage - a.percentage).slice(0, 10),
        weeklyTrend,
      },
    });
  } catch (error) {
    console.error('Department analytics error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== HELPER FUNCTIONS ====================
async function getTodayAttendanceStats(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, present] = await Promise.all([
    prisma.attendance.count({ where: { date: today } }),
    prisma.attendance.count({ where: { date: today, status: 'PRESENT' } }),
  ]);

  return total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
}

async function getMonthlyAttendanceTrend(): Promise<any[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: sixMonthsAgo } },
  });

  const monthlyData: { [key: string]: { total: number; present: number } } = {};

  for (const record of attendance) {
    const month = record.date.toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { total: 0, present: 0 };
    }
    monthlyData[month].total++;
    if (record.status === 'PRESENT') {
      monthlyData[month].present++;
    }
  }

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    percentage: data.total > 0 ? Math.round((data.present / data.total) * 1000) / 10 : 0,
  }));
}

async function getDepartmentStats(): Promise<any[]> {
  const departments = await prisma.department.findMany({
    include: {
      students: { include: { attendance: true } },
    },
  });

  return departments.map(dept => {
    let total = 0;
    let present = 0;
    for (const student of dept.students) {
      total += student.attendance.length;
      present += student.attendance.filter(a => a.status === 'PRESENT').length;
    }
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      studentCount: dept.students.length,
      attendancePercentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
    };
  });
}

async function getClassPerformance(facultyId: string): Promise<any[]> {
  const classes = await prisma.class.findMany({
    where: { inchargeId: facultyId },
    include: {
      students: { include: { attendance: true } },
    },
  });

  return classes.map(cls => {
    let total = 0;
    let present = 0;
    for (const student of cls.students) {
      total += student.attendance.length;
      present += student.attendance.filter(a => a.status === 'PRESENT').length;
    }
    return {
      classId: cls.id,
      className: `${cls.name} - ${cls.section}`,
      studentCount: cls.students.length,
      attendancePercentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
    };
  });
}

async function getWeeklyTrend(departmentId: string): Promise<{ date: string; percentage: number }[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const attendance = await prisma.attendance.findMany({
    where: {
      date: { gte: sevenDaysAgo },
      student: { departmentId },
    },
  });

  const dailyData: { [key: string]: { total: number; present: number } } = {};

  for (const record of attendance) {
    const date = record.date.toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { total: 0, present: 0 };
    }
    dailyData[date].total++;
    if (record.status === 'PRESENT') {
      dailyData[date].present++;
    }
  }

  return Object.entries(dailyData).map(([date, data]) => ({
    date,
    percentage: data.total > 0 ? Math.round((data.present / data.total) * 1000) / 10 : 0,
  }));
}

function calculateRiskScore(attendance: any[]): number {
  if (attendance.length === 0) return 0;

  const present = attendance.filter(a => a.status === 'PRESENT').length;
  const percentage = (present / attendance.length) * 100;

  // Late pattern analysis
  const lateCount = attendance.filter(a => a.status === 'LATE').length;
  const lateRatio = lateCount / attendance.length;

  // Recent trend
  const recent = attendance.slice(-10);
  const recentPresent = recent.filter(a => a.status === 'PRESENT').length;
  const recentPercentage = recent.length > 0 ? (recentPresent / recent.length) * 100 : 0;

  // Calculate risk score (0-100)
  let riskScore = 0;
  if (percentage < 75) riskScore += 40;
  if (percentage < 60) riskScore += 30;
  if (lateRatio > 0.2) riskScore += 15;
  if (recentPercentage < percentage) riskScore += 15;

  return Math.min(100, riskScore);
}

function generateRecommendations(percentage: number, riskScore: number): string[] {
  const recommendations = [];

  if (percentage < 75) {
    recommendations.push('Your attendance is below the required 75%. Attend all upcoming classes.');
  }
  if (riskScore > 50) {
    recommendations.push('You are at high risk of attendance shortage. Meet your class coordinator.');
  }
  if (percentage < 60) {
    recommendations.push('Critical attendance level. Immediate action required.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Your attendance is good. Keep it up!');
  }

  return recommendations;
}