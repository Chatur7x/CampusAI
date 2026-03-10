import { useEffect, useState } from 'react';
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
import { Calendar, Plus, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { TimetableEntry, Class, Faculty, Course, Profile } from '@/lib/database.types';
import { timetableService, classService, facultyService, courseService, auditLogService } from '@/lib/api';

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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntryWithRelations | null>(null);
  const [form, setForm] = useState({
    classId: '',
    courseId: '',
    facultyId: '',
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: '',
  });

  // ── Today/Now detection ──
  const now = new Date();
  const todayDayIdx = now.getDay() === 0 ? -1 : now.getDay() - 1; // Mon=0..Sat=5, Sun=-1
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
      toast.success('Timetable entry added');
      auditLogService.log('CREATE', 'timetable_entry', '', { newValues: form });
      setIsAddOpen(false);
      fetchTimetable();
    } catch (error) {
      toast.error('Failed to add entry');
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    try {
      await timetableService.delete(selectedEntry.id);
      toast.success('Entry deleted');
      auditLogService.log('DELETE', 'timetable_entry', selectedEntry.id, {});
      setIsDeleteOpen(false);
      setSelectedEntry(null);
      fetchTimetable();
    } catch (error) {
      toast.error('Failed to delete');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Timetable</h1>
          <p className="text-slate-400">{todayDateStr} • {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-3">
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
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Day</Label>
                    <Select value={String(form.dayOfWeek)} onValueChange={(v) => setForm({ ...form, dayOfWeek: parseInt(v, 10) })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Course</Label>
                    <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v })}>
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
                    <Select value={form.facultyId} onValueChange={(v) => setForm({ ...form, facultyId: v })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {facultyList.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.profile?.first_name} {f.profile?.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Start Time</Label>
                    <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">End Time</Label>
                    <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Room Number</Label>
                  <Input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="e.g., Lab-301" />
                </div>
              </div>
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
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-white/70 hover:text-white" onClick={() => { setSelectedEntry(entry); setIsDeleteOpen(true); }}>
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