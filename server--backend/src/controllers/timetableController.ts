import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';

// TimetableEntry uses @map so Prisma keeps camelCase field names:
// classId, subjectId, facultyId, dayOfWeek, startTime, endTime, roomNumber, isActive, sessionType

// ==================== TIMETABLE CRUD ====================
export const createTimetableEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId, subjectId, facultyId, dayOfWeek, startTime, endTime, roomNumber } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const conflicts = await checkTimetableConflicts(classId, facultyId, roomNumber, dayOfWeek, startTime, endTime);
    if (conflicts.length > 0) {
      res.status(409).json({ success: false, message: 'Timetable conflicts detected', data: { conflicts } });
      return;
    }

    const entry = await prisma.timetableEntry.create({
      data: {
        classId,
        subjectId,
        facultyId,
        dayOfWeek,
        startTime,
        endTime,
        roomNumber,
        isActive: true,
      },
      include: {
        class: true,
        subject: true,
        faculty: { include: { users: { include: { profiles: true } } } },
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'CREATE_TIMETABLE_ENTRY',
      entityType: 'timetable',
      entityId: entry.id,
      newValue: entry,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'Timetable entry created successfully', data: entry });
  } catch (error) {
    console.error('Create timetable entry error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTimetable = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId, facultyId, studentId } = req.query;

    const where: any = { isActive: true };

    if (classId) {
      where.classId = classId as string;
    } else if (facultyId) {
      where.facultyId = facultyId as string;
    } else if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId as string } });
      if (student) where.classId = student.class_id;
    }

    const entries = await prisma.timetableEntry.findMany({
      where,
      include: {
        class: true,
        subject: true,
        faculty: { include: { users: { include: { profiles: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.status(200).json({
      success: true,
      data: { entries, groupedByDay: groupTimetableByDay(entries) },
    });
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyTimetable = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    let entries: any[] = [];

    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { user_id: req.user.id } });
      if (student) {
        entries = await prisma.timetableEntry.findMany({
          where: { classId: student.class_id, isActive: true },
          include: {
            subject: true,
            faculty: { include: { users: { include: { profiles: true } } } },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
      }
    } else if (req.user.role === 'FACULTY' || req.user.role === 'CLASS_INCHARGE') {
      const faculty = await prisma.faculty.findUnique({ where: { user_id: req.user.id } });
      if (faculty) {
        entries = await prisma.timetableEntry.findMany({
          where: { facultyId: faculty.id, isActive: true },
          include: {
            class: true,
            subject: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
      }
    }

    res.status(200).json({
      success: true,
      data: { entries, groupedByDay: groupTimetableByDay(entries) },
    });
  } catch (error) {
    console.error('Get my timetable error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateTimetableEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { classId, subjectId, facultyId, dayOfWeek, startTime, endTime, roomNumber } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingEntry = await prisma.timetableEntry.findUnique({ where: { id } });
    if (!existingEntry) {
      res.status(404).json({ success: false, message: 'Timetable entry not found' });
      return;
    }

    const conflicts = await checkTimetableConflicts(
      classId || existingEntry.classId,
      facultyId || existingEntry.facultyId,
      roomNumber || existingEntry.roomNumber,
      dayOfWeek || existingEntry.dayOfWeek,
      startTime || existingEntry.startTime,
      endTime || existingEntry.endTime,
      id
    );

    if (conflicts.length > 0) {
      res.status(409).json({ success: false, message: 'Timetable conflicts detected', data: { conflicts } });
      return;
    }

    const entry = await prisma.timetableEntry.update({
      where: { id },
      data: {
        ...(classId && { classId }),
        ...(subjectId && { subjectId }),
        ...(facultyId && { facultyId }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(roomNumber !== undefined && { roomNumber }),
      },
      include: {
        class: true,
        subject: true,
        faculty: { include: { users: { include: { profiles: true } } } },
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'UPDATE_TIMETABLE_ENTRY',
      entityType: 'timetable',
      entityId: id,
      oldValue: existingEntry,
      newValue: entry,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'Timetable entry updated successfully', data: entry });
  } catch (error) {
    console.error('Update timetable entry error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteTimetableEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const existingEntry = await prisma.timetableEntry.findUnique({ where: { id } });
    if (!existingEntry) {
      res.status(404).json({ success: false, message: 'Timetable entry not found' });
      return;
    }

    await prisma.timetableEntry.update({ where: { id }, data: { isActive: false } });

    await logAction({
      userId: req.user.id,
      action: 'DELETE_TIMETABLE_ENTRY',
      entityType: 'timetable',
      entityId: id,
      oldValue: existingEntry,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const bulkCreateTimetable = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { entries } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const results = [];
    const errors = [];

    for (const entry of entries) {
      try {
        const conflicts = await checkTimetableConflicts(
          entry.classId, entry.facultyId, entry.roomNumber,
          entry.dayOfWeek, entry.startTime, entry.endTime
        );

        if (conflicts.length > 0) {
          errors.push({ entry, error: 'Conflicts detected', conflicts });
          continue;
        }

        const created = await prisma.timetableEntry.create({
          data: {
            classId: entry.classId,
            subjectId: entry.subjectId,
            facultyId: entry.facultyId,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            roomNumber: entry.roomNumber,
            isActive: true,
          },
        });
        results.push(created);
      } catch (err) {
        errors.push({ entry, error: (err as Error).message });
      }
    }

    await logAction({
      userId: req.user.id,
      action: 'BULK_CREATE_TIMETABLE',
      entityType: 'timetable',
      newValue: { count: results.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Created ${results.length} timetable entries`,
      data: { results, errors },
    });
  } catch (error) {
    console.error('Bulk create timetable error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== HELPER FUNCTIONS ====================
async function checkTimetableConflicts(
  classId: string,
  facultyId: string,
  roomNumber: string | null | undefined,
  dayOfWeek: number,
  startTime: any,
  endTime: any,
  excludeId?: string
): Promise<any[]> {
  const conflicts = [];

  const where: any = {
    dayOfWeek,
    isActive: true,
    ...(excludeId && { id: { not: excludeId } }),
    OR: [
      { classId },
      { facultyId },
      ...(roomNumber ? [{ roomNumber }] : []),
    ],
    AND: [
      {
        OR: [
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: startTime }, endTime: { lte: endTime } },
        ],
      },
    ],
  };

  const existingEntries = await prisma.timetableEntry.findMany({ where });

  for (const entry of existingEntries) {
    if (entry.classId === classId) {
      conflicts.push({ type: 'CLASS', message: 'Class has another subject at this time', entry });
    }
    if (entry.facultyId === facultyId) {
      conflicts.push({ type: 'FACULTY', message: 'Faculty is assigned to another class at this time', entry });
    }
    if (entry.roomNumber && entry.roomNumber === roomNumber) {
      conflicts.push({ type: 'ROOM', message: 'Room is occupied at this time', entry });
    }
  }

  return conflicts;
}

function groupTimetableByDay(entries: any[]): { [key: number]: any[] } {
  const grouped: { [key: number]: any[] } = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  for (const entry of entries) {
    const day = entry.dayOfWeek ?? entry.day_of_week;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(entry);
  }

  for (const day in grouped) {
    grouped[day].sort((a, b) => {
      const aTime = a.startTime || a.start_time;
      const bTime = b.startTime || b.start_time;
      return String(aTime).localeCompare(String(bTime));
    });
  }

  return grouped;
}
