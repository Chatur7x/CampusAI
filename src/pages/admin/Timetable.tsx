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
import type { TimetableEntry, Class, Faculty } from '@/types';

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

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntry | null>(null);
  const [form, setForm] = useState({
    classId: '',
    subjectId: '',
    facultyId: '',
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: '',
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchClasses();
    fetchFaculty();
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchTimetable();
  }, [selectedClassId]);

  const fetchTimetable = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/timetable?classId=${selectedClassId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) setEntries(data.data);
      }
    } catch (error) {
      console.error('Error fetching timetable:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClasses(data.data);
          if (data.data.length > 0) setSelectedClassId(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      if (!selectedClassId) setIsLoading(false);
    }
  };

  const fetchFaculty = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/admin/users?role=FACULTY`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) setFacultyList(data.data.users?.map((u: any) => ({ ...u.faculty, user: u })).filter((f: any) => f?.id) || []);
      }
    } catch (error) {
      console.error('Error fetching faculty:', error);
    }
  };

  const handleAdd = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, classId: selectedClassId }),
      });
      if (response.ok) {
        toast.success('Timetable entry added');
        setIsAddOpen(false);
        fetchTimetable();
      } else {
        toast.error('Failed to add entry');
      }
    } catch (error) {
      toast.error('Failed to add entry');
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/timetable/${selectedEntry.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Entry deleted');
        setIsDeleteOpen(false);
        setSelectedEntry(null);
        fetchTimetable();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const getEntriesForSlot = (dayIdx: number, time: string) => {
    return entries.filter(
      (e) => e.dayOfWeek === dayIdx && e.startTime <= time && e.endTime > time
    );
  };

  const getColorForSubject = (subjectId: string) => {
    const idx = Math.abs(subjectId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length;
    return COLORS[idx];
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Timetable</h1>
          <p className="text-slate-400">Manage weekly class schedules</p>
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
                    <Select value={String(form.dayOfWeek)} onValueChange={(v) => setForm({ ...form, dayOfWeek: parseInt(v) })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Faculty</Label>
                    <Select value={form.facultyId} onValueChange={(v) => setForm({ ...form, facultyId: v })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {facultyList.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.user?.profile?.firstName} {f.user?.profile?.lastName}</SelectItem>
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
            <div><p className="text-2xl font-bold text-white">{new Set(entries.map(e => e.subjectId)).size}</p><p className="text-xs text-slate-400">Subjects</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-cyan-400" /></div>
            <div><p className="text-2xl font-bold text-white">{new Set(entries.map(e => e.facultyId)).size}</p><p className="text-xs text-slate-400">Faculty Assigned</p></div>
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
                {DAYS.map((day) => (
                  <div key={day} className="text-xs text-slate-400 font-medium p-2 text-center bg-slate-800/50 rounded">{day}</div>
                ))}
              </div>
              {/* Time Slots */}
              {TIME_SLOTS.map((time) => (
                <div key={time} className="grid grid-cols-[80px_repeat(6,1fr)] gap-1 mb-1">
                  <div className="text-xs text-slate-500 p-2 flex items-center">{time}</div>
                  {DAYS.map((_, dayIdx) => {
                    const slotEntries = getEntriesForSlot(dayIdx, time);
                    return (
                      <div key={dayIdx} className="min-h-[60px] bg-slate-800/30 rounded p-1">
                        {slotEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className={`${getColorForSubject(entry.subjectId || entry.id)} rounded p-2 text-xs border cursor-pointer group relative`}
                          >
                            <p className="font-medium truncate">{entry.subject?.name || 'Subject'}</p>
                            <p className="opacity-70 truncate">{entry.faculty?.user?.profile?.firstName || 'Faculty'}</p>
                            {entry.roomNumber && <p className="opacity-50">{entry.roomNumber}</p>}
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