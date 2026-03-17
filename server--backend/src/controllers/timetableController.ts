import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { logAction } from '../utils/audit';

// ==================== TIMETABLE CRUD ====================
export const createTimetableEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId, subjectId, facultyId, dayOfWeek, startTime, endTime, roomNumber } = req.body;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    // Check for conflicts
    const conflicts = await checkTimetableConflicts(classId, facultyId, roomNumber, dayOfWeek, startTime, endTime);
    if (conflicts.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Timetable conflicts detected',
        data: { conflicts },
      });
      return;
    }

    const entry = await prisma.timetableEntry.create({
      data: {
        class_id: classId,
        subject_id: subjectId,
        faculty_id: facultyId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room_number: roomNumber,
        is_active: true
      },
      include: {
        classes: true,
        subjects: true,
        faculties: { include: { users: { include: { profiles: true } } } },
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

    res.status(201).json({
      success: true,
      message: 'Timetable entry created successfully',
      data: entry,
    });
  } catch (error) {
    console.error('Create timetable entry error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTimetable = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId, facultyId, studentId } = req.query;

    let where: any = { is_active: true };

    if (classId) {
      where.class_id = classId as string;
    } else if (facultyId) {
      where.faculty_id = facultyId as string;
    } else if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId as string },
      });
      if (student) {
        where.class_id = student.class_id;
      }
    }

    const entries = await prisma.timetableEntry.findMany({
      where,
      include: {
        classes: true,
        subjects: true,
        faculties: { include: { users: { include: { profiles: true } } } },
      },
      orderBy: [
        { day_of_week: 'asc' },
        { start_time: 'asc' },
      ],
    });

    // Group by day
    const groupedByDay = groupTimetableByDay(entries);

    res.status(200).json({
      success: true,
      data: {
        entries,
        groupedByDay,
      },
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
      const student = await prisma.student.findUnique({
        where: { user_id: req.user.id },
      });
      if (student) {
        entries = await prisma.timetableEntry.findMany({
          where: { class_id: student.class_id, is_active: true },
          include: {
            subjects: true,
            faculties: { include: { users: { include: { profiles: true } } } },
          },
          orderBy: [
            { day_of_week: 'asc' },
            { start_time: 'asc' },
          ],
        });
      }
    } else if (req.user.role === 'FACULTY' || req.user.role === 'CLASS_INCHARGE') {
      const faculty = await prisma.faculty.findUnique({
        where: { user_id: req.user.id },
      });
      if (faculty) {
        entries = await prisma.timetableEntry.findMany({
          where: { faculty_id: faculty.id, is_active: true },
          include: {
            classes: true,
            subjects: true,
          },
          orderBy: [
            { day_of_week: 'asc' },
            { start_time: 'asc' },
          ],
        });
      }
    }

    const groupedByDay = groupTimetableByDay(entries);

    res.status(200).json({
      success: true,
      data: {
        entries,
        groupedByDay,
      },
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

    // Check for conflicts (excluding current entry)
    const conflicts = await checkTimetableConflicts(
      classId || existingEntry.class_id,
      facultyId || existingEntry.faculty_id,
      roomNumber || existingEntry.room_number,
      dayOfWeek || existingEntry.day_of_week,
      startTime || existingEntry.start_time,
      endTime || existingEntry.end_time,
      id
    );

    if (conflicts.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Timetable conflicts detected',
        data: { conflicts },
      });
      return;
    }

    const entry = await prisma.timetableEntry.update({
      where: { id },
      data: {
        class_id: classId,
        subject_id: subjectId,
        faculty_id: facultyId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room_number: roomNumber,
      },
      include: {
        classes: true,
        subjects: true,
        faculties: { include: { users: { include: { profiles: true } } } },
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

    res.status(200).json({
      success: true,
      message: 'Timetable entry updated successfully',
      data: entry,
    });
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

    // Soft delete
    await prisma.timetableEntry.update({ 
        where: { id },
        data: { is_active: false }
    });

    await logAction({
      userId: req.user.id,
      action: 'DELETE_TIMETABLE_ENTRY',
      entityType: 'timetable',
      entityId: id,
      oldValue: existingEntry,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Timetable entry deleted successfully',
    });
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== BULK OPERATIONS ====================
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
          entry.classId,
          entry.facultyId,
          entry.roomNumber,
          entry.dayOfWeek,
          entry.startTime,
          entry.endTime
        );

        if (conflicts.length > 0) {
          errors.push({ entry, error: 'Conflicts detected', conflicts });
          continue;
        }

        const created = await prisma.timetableEntry.create({
          data: {
              class_id: entry.classId,
              subject_id: entry.subjectId,
              faculty_id: entry.facultyId,
              day_of_week: entry.dayOfWeek,
              start_time: entry.startTime,
              end_time: entry.endTime,
              room_number: entry.roomNumber,
              is_active: true
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
  roomNumber: string | null,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<any[]> {
  const conflicts = [];

  const where: any = {
    day_of_week: dayOfWeek,
    is_active: true,
    id: excludeId ? { not: excludeId } : undefined,
    OR: [
      { class_id: classId },
      { faculty_id: facultyId },
      roomNumber ? { room_number: roomNumber } : {},
    ],
    AND: [
      {
        OR: [
          { start_time: { lte: startTime }, end_time: { gt: startTime } },
          { start_time: { lt: endTime }, end_time: { gte: endTime } },
          { start_time: { gte: startTime }, end_time: { lte: endTime } },
        ],
      },
    ],
  };

  const existingEntries = await prisma.timetableEntry.findMany({ where });

  for (const entry of existingEntries) {
    if (entry.class_id === classId) {
      conflicts.push({ type: 'CLASS', message: 'Class has another subject at this time', entry });
    }
    if (entry.faculty_id === facultyId) {
      conflicts.push({ type: 'FACULTY', message: 'Faculty is assigned to another class at this time', entry });
    }
    if (entry.room_number && entry.room_number === roomNumber) {
      conflicts.push({ type: 'ROOM', message: 'Room is occupied at this time', entry });
    }
  }

  return conflicts;
}

function groupTimetableByDay(entries: any[]): { [key: number]: any[] } {
  const grouped: { [key: number]: any[] } = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
  };

  for (const entry of entries) {
    if (!grouped[entry.day_of_week]) {
      grouped[entry.day_of_week] = [];
    }
    grouped[entry.day_of_week].push(entry);
  }

  // Sort each day's entries by start time
  for (const day in grouped) {
    grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  return grouped;
}