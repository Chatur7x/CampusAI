import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Plus, Trash2, Clock, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { TimetableEntry, Class, Faculty, Course, Profile } from '@/lib/database.types';
import { timetableService, classService, facultyService, courseService, auditLogService, notificationService } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
];

const COLORS = [
  'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'bg-blue-500/20 text-blue-300 border-blue-500/30',
];

type TimetableEntryWithRelations = TimetableEntry & {
  course?: Course;
  faculty?: (Faculty & { profile?: Profile | null }) | null;
};

type FacultyWithProfile = Faculty & { profile?: Profile | null };

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntryWithRelations[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntryWithRelations | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    classId: '',
    courseId: '',
    facultyId: '',
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: '',
  });
  const [editForm, setEditForm] = useState({
    courseId: '',
    facultyId: '',
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: '',
  });

  // ── Today/Now detection ──
  const now = new Date();
  const todayDayIdx = now.getDay() === 0 ? -1 : now.getDay() - 1;
  const currentHour = `${String(now.getHours()).padStart(2, '0')}:00`;
  const todayDateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchClasses();
    fetchCourses();
    fetchFaculty();
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchTimetable();
  }, [selectedClassId]);

  const fetchTimetable = async () => {
    setIsLoading(true);
    try {
      const data = await timetableService.getForClass(selectedClassId);
      setEntries(data as TimetableEntryWithRelations[]);
    } catch (error) {
      console.error('Error fetching timetable:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const data = await classService.getAll();
      setClasses(data);
      if (data.length > 0) setSelectedClassId(data[0].id);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      if (!selectedClassId) setIsLoading(false);
    }
  };

  const fetchFaculty = async () => {
    try {
      const data = await facultyService.getAll();
      setFacultyList(data);
    } catch (error) {
      console.error('Error fetching faculty:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await courseService.getAll();
      setCourses(data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  // ── Notify affected faculty ──
  const notifyFaculty = async (facultyId: string, action: string, details: string) => {
    try {
      const fac = facultyList.find(f => f.id === facultyId);
      const userId = fac?.user_id || (fac as any)?.userId;
      if (userId) {
        await notificationService.create({
          user_id: userId,
          type: 'TIMETABLE_UPDATE' as any,
          title: `Timetable ${action}`,
          message: details,
        });
      }
    } catch {
      // Notification failure shouldn't block the operation
    }
  };

  const handleAdd = async () => {
    if (!selectedClassId || !form.courseId || !form.facultyId) {
      toast.error('Class, course, and faculty are required');
      return;
    }
    try {
      await timetableService.create({
        class_id: selectedClassId,
        course_id: form.courseId,
        faculty_id: form.facultyId,
        day_of_week: form.dayOfWeek,
        start_time: form.startTime,
        end_time: form.endTime,
        room: form.roomNumber || null,
      });
      const courseName = courses.find(c => c.id === form.courseId)?.name || '';
      const className = selectedClass?.name || '';
      toast.success('Timetable entry added');
      auditLogService.log('CREATE', 'timetable_entry', '', { newValues: form });
      notifyFaculty(form.facultyId, 'Updated', `New period added: ${courseName} for ${className} on ${DAYS[form.dayOfWeek]} ${form.startTime}-${form.endTime}`);
      setIsAddOpen(false);
      fetchTimetable();
    } catch (error) {
      toast.error('Failed to add entry');
    }
  };

  // ── Edit handler ──
  const openEdit = (entry: TimetableEntryWithRelations) => {
    setSelectedEntry(entry);
    setEditForm({
      courseId: entry.course_id || '',
      facultyId: entry.faculty_id || '',
      dayOfWeek: entry.day_of_week ?? 0,
      startTime: entry.start_time || '09:00',
      endTime: entry.end_time || '10:00',
      roomNumber: entry.room || '',
    });
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedEntry) return;
    try {
      await timetableService.update(selectedEntry.id, {
        course_id: editForm.courseId,
        faculty_id: editForm.facultyId,
        day_of_week: editForm.dayOfWeek,
        start_time: editForm.startTime,
        end_time: editForm.endTime,
        room: editForm.roomNumber || null,
      });
      const courseName = courses.find(c => c.id === editForm.courseId)?.name || '';
      toast.success('Timetable entry updated');
      auditLogService.log('UPDATE', 'timetable_entry', selectedEntry.id, { oldValues: selectedEntry, newValues: editForm });
      notifyFaculty(editForm.facultyId, 'Modified', `Schedule updated: ${courseName} on ${DAYS[editForm.dayOfWeek]} ${editForm.startTime}-${editForm.endTime}`);
      // If faculty changed, also notify the old faculty
      if (selectedEntry.faculty_id && selectedEntry.faculty_id !== editForm.facultyId) {
        notifyFaculty(selectedEntry.faculty_id, 'Removed', `You have been unassigned from a period on ${DAYS[editForm.dayOfWeek]} ${editForm.startTime}-${editForm.endTime}`);
      }
      setIsEditOpen(false);
      setSelectedEntry(null);
      fetchTimetable();
    } catch (error) {
      toast.error('Failed to update entry');
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    try {
      await timetableService.delete(selectedEntry.id);
      toast.success('Entry deleted');
      auditLogService.log('DELETE', 'timetable_entry', selectedEntry.id, {});
      if (selectedEntry.faculty_id) {
        const courseName = selectedEntry.course?.name || '';
        notifyFaculty(selectedEntry.faculty_id, 'Removed', `Period removed: ${courseName} on ${DAYS[selectedEntry.day_of_week ?? 0]}`);
      }
      setIsDeleteOpen(false);
      setSelectedEntry(null);
      fetchTimetable();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // ── CSV Import ──
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV must have header + at least 1 row'); return; }

      // Expected CSV: day,course_code,faculty_employee_id,start_time,end_time,room
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const dayCol = header.findIndex(h => h.includes('day'));
      const courseCol = header.findIndex(h => h.includes('course'));
      const facCol = header.findIndex(h => h.includes('faculty') || h.includes('employee'));
      const startCol = header.findIndex(h => h.includes('start'));
      const endCol = header.findIndex(h => h.includes('end'));
      const roomCol = header.findIndex(h => h.includes('room'));

      if (dayCol < 0 || courseCol < 0 || startCol < 0 || endCol < 0) {
        toast.error('CSV must have columns: day, course, start_time, end_time');
        return;
      }

      let imported = 0;
      let skipped = 0;
      const notifiedFaculty = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const dayStr = cols[dayCol]?.toLowerCase();
        const dayIdx = DAYS.findIndex(d => d.toLowerCase() === dayStr || d.toLowerCase().startsWith(dayStr));
        if (dayIdx < 0) { skipped++; continue; }

        const courseCode = cols[courseCol];
        const course = courses.find(c => c.code?.toLowerCase() === courseCode?.toLowerCase() || c.name?.toLowerCase() === courseCode?.toLowerCase());
        if (!course) { skipped++; continue; }

        let faculty: FacultyWithProfile | undefined;
        if (facCol >= 0 && cols[facCol]) {
          faculty = facultyList.find(f =>
            f.employee_id?.toLowerCase() === cols[facCol]?.toLowerCase() ||
            f.profile?.first_name?.toLowerCase() === cols[facCol]?.toLowerCase()
          );
        }

        try {
          await timetableService.create({
            class_id: selectedClassId,
            course_id: course.id,
            faculty_id: faculty?.id || undefined,
            day_of_week: dayIdx,
            start_time: cols[startCol] || '09:00',
            end_time: cols[endCol] || '10:00',
            room: roomCol >= 0 ? cols[roomCol] || null : null,
          });
          imported++;
          if (faculty?.id) notifiedFaculty.add(faculty.id);
        } catch { skipped++; }
      }

      // Notify all affected faculty
      for (const fId of notifiedFaculty) {
        notifyFaculty(fId, 'Bulk Update', `${imported} new periods added to your schedule via CSV import`);
      }

      toast.success(`Imported ${imported} entries${skipped > 0 ? `, ${skipped} skipped` : ''}`);
      auditLogService.log('BULK_IMPORT', 'timetable_entry', selectedClassId, { newValues: { imported, skipped } });
      fetchTimetable();
      setIsCsvOpen(false);
    } catch (error) {
      toast.error('CSV import failed');
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const getEntriesForSlot = (dayIdx: number, time: string) => {
    return entries.filter(
      (e) => e.day_of_week === dayIdx && e.start_time <= time && e.end_time > time
    );
  };

  const getColorForSubject = (courseId: string) => {
    const idx = Math.abs(courseId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length;
    return COLORS[idx];
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // ── Shared form fields JSX builder ──
  const renderFormFields = (
    f: typeof form | typeof editForm,
    setF: (v: typeof form | typeof editForm) => void
  ) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Day</Label>
          <Select value={String(f.dayOfWeek)} onValueChange={(v) => setF({ ...f, dayOfWeek: parseInt(v, 10) })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Course</Label>
          <Select value={f.courseId} onValueChange={(v) => setF({ ...f, courseId: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>{course.code} - {course.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Faculty</Label>
          <Select value={f.facultyId} onValueChange={(v) => setF({ ...f, facultyId: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {facultyList.map((fc) => (
                <SelectItem key={fc.id} value={fc.id}>{fc.profile?.first_name} {fc.profile?.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Start Time</Label>
          <Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">End Time</Label>
          <Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Room Number</Label>
        <Input value={f.roomNumber} onChange={(e) => setF({ ...f, roomNumber: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="e.g., Lab-301" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Timetable</h1>
          <p className="text-slate-400">{todayDateStr} • {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[220px] bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* CSV Import Button */}
          <Dialog open={isCsvOpen} onOpenChange={setIsCsvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <Upload className="w-4 h-4 mr-2" />CSV Import
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-white">Import Timetable from CSV</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Upload a CSV file with columns: <span className="text-violet-400">day, course, faculty, start_time, end_time, room</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-lg bg-slate-800/50 p-4 text-xs text-slate-400 font-mono">
                  <p className="text-slate-300 font-semibold mb-2">Example CSV format:</p>
                  <p>day,course,faculty,start_time,end_time,room</p>
                  <p>Monday,CS201,FAC-001,09:00,10:00,Lab-301</p>
                  <p>Tuesday,CS201,FAC-001,10:00,11:00,Lab-302</p>
                </div>
                <Input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvImport}
                  disabled={csvImporting}
                  className="bg-slate-800 border-slate-700 text-white file:bg-violet-600 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1 file:mr-3 file:cursor-pointer"
                />
                {csvImporting && <p className="text-sm text-violet-400 animate-pulse">Importing…</p>}
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Entry Button */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" />Add Entry</Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-white">Add Timetable Entry</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Add a new period to {selectedClass?.name} - {selectedClass?.section}
                </DialogDescription>
              </DialogHeader>
              {renderFormFields(form, setForm as any)}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} className="bg-violet-600 hover:bg-violet-700">Add Entry</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-violet-400" /></div>
            <div><p className="text-2xl font-bold text-white">{entries.length}</p><p className="text-xs text-slate-400">Total Periods</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-emerald-400" /></div>
            <div><p className="text-2xl font-bold text-white">{new Set(entries.map(e => e.course_id)).size}</p><p className="text-xs text-slate-400">Courses</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-cyan-400" /></div>
            <div><p className="text-2xl font-bold text-white">{new Set(entries.map(e => e.faculty_id)).size}</p><p className="text-xs text-slate-400">Faculty Assigned</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Timetable Grid */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
            </div>
          ) : !selectedClassId ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a class to view timetable</p>
            </div>
          ) : (
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-[80px_repeat(6,1fr)] gap-1 mb-2">
                <div className="text-xs text-slate-500 font-medium p-2">Time</div>
                {DAYS.map((day, dayIdx) => (
                  <div key={day} className={`text-xs font-medium p-2 text-center rounded ${dayIdx === todayDayIdx ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'text-slate-400 bg-slate-800/50'}`}>{day}{dayIdx === todayDayIdx ? ' (Today)' : ''}</div>
                ))}
              </div>
              {/* Time Slots */}
              {TIME_SLOTS.map((time) => (
                <div key={time} className={`grid grid-cols-[80px_repeat(6,1fr)] gap-1 mb-1 ${time === currentHour ? 'ring-1 ring-violet-500/30 rounded bg-violet-500/5' : ''}`}>
                  <div className={`text-xs p-2 flex items-center ${time === currentHour ? 'text-violet-400 font-semibold' : 'text-slate-500'}`}>{time}{time === currentHour ? ' ◀' : ''}</div>
                  {DAYS.map((_, dayIdx) => {
                    const slotEntries = getEntriesForSlot(dayIdx, time);
                    return (
                      <div key={dayIdx} className="min-h-[60px] bg-slate-800/30 rounded p-1">
                        {slotEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className={`${getColorForSubject(entry.course_id || entry.id)} rounded p-2 text-xs border cursor-pointer group relative`}
                          >
                            <p className="font-medium truncate">{entry.course?.name || 'Course'}</p>
                            <p className="opacity-70 truncate">{entry.faculty?.profile?.first_name || 'Faculty'}</p>
                            {entry.room && <p className="opacity-50">{entry.room}</p>}
                            <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-white/70 hover:text-white" onClick={() => openEdit(entry)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-white/70 hover:text-red-400" onClick={() => { setSelectedEntry(entry); setIsDeleteOpen(true); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Timetable Entry</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update this period for {selectedClass?.name}
            </DialogDescription>
          </DialogHeader>
          {renderFormFields(editForm, setEditForm as any)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} className="bg-violet-600 hover:bg-violet-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Timetable Entry</DialogTitle>
            <DialogDescription className="text-slate-400">
              Remove this period from the timetable? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}