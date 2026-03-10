import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { GraduationCap, TrendingDown, AlertCircle, Mail, Send, Loader2 } from 'lucide-react';
import { timetableService, studentService, attendanceService, notificationService } from '@/lib/api';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import type { Student, TimetableEntry } from '@/lib/database.types';

interface StudentWithRisk {
  student: Student;
  percentage: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

type FacultyTimetableEntry = TimetableEntry & {
  class?: { id?: string; name?: string };
  course?: { id?: string; name?: string };
};

export default function MyStudentsPage() {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [items, setItems] = useState<StudentWithRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagingStudent, setMessagingStudent] = useState<Student | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.faculty?.id) return;
      try {
        setLoading(true);
        const timetable = (await timetableService.getForFaculty(user.faculty.id)) as FacultyTimetableEntry[];
        const classIds = Array.from(new Set(timetable.map((t) => t.class_id))).filter(Boolean) as string[];

        // Fetch all classes in parallel (instead of sequential loop)
        const classStudents = await Promise.all(
          classIds.map((classId) => studentService.getAll({ classId }))
        );
        const allStudents = classStudents.flat();

        // Fetch all statistics in parallel (instead of nested sequential loop)
        const statsResults = await Promise.all(
          allStudents.map((student) => attendanceService.getStatistics(student.id))
        );

        const roster: StudentWithRisk[] = allStudents.map((student, i) => {
          const pct = Math.round((statsResults[i].percentage as number) || 0);
          const risk: StudentWithRisk['risk'] = pct < 60 ? 'HIGH' : pct < 75 ? 'MEDIUM' : 'LOW';
          return { student, percentage: pct, risk };
        });
        setItems(roster);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.faculty?.id]);

  const handleSendMessage = async () => {
    if (!messagingStudent || !messageContent.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    if (!messagingStudent.user_id) {
      toast.error('This student has not linked their user account yet');
      return;
    }
    setSendingMessage(true);
    try {
      await notificationService.create({
        user_id: messagingStudent.user_id,
        type: 'SYSTEM',
        title: `Message from ${user?.profile?.first_name || 'Faculty'}`,
        message: messageContent.trim(),
      });
      toast.success('Message sent to student successfully');
      setMessagingStudent(null);
      setMessageContent('');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const total = items.length;
  const atRisk = items.filter((s) => s.risk !== 'LOW').length;
  const critical = items.filter((s) => s.risk === 'HIGH').length;

  const summary = useMemo(
    () => ({ total, atRisk, critical }),
    [total, atRisk, critical]
  );

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return 'bg-red-500/20 text-red-400';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-emerald-500/20 text-emerald-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Students</h1>
          <p className="text-slate-400">View and manage your students</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate('/faculty/register-student')}>
          Register new student
        </Button>
      </div>

        <Dialog open={!!messagingStudent} onOpenChange={(open) => !open && setMessagingStudent(null)}>
          <DialogContent className="bg-slate-900 border border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>Send Message to {messagingStudent?.profile?.first_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Message Content</Label>
                <Textarea 
                  className="bg-slate-800 border-slate-700 min-h-[120px]" 
                  placeholder="Type your message here. It will be sent as a direct notification..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                />
              </div>
              <Button onClick={handleSendMessage} disabled={sendingMessage} className="w-full bg-cyan-600 hover:bg-cyan-700">
                {sendingMessage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Students</p>
                <p className="text-2xl font-bold text-white">{loading ? '—' : summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">At Risk</p>
                <p className="text-2xl font-bold text-white">{loading ? '—' : summary.atRisk}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Critical</p>
                <p className="text-2xl font-bold text-white">{loading ? '—' : summary.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Student List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading students...</p>
          ) : items.length === 0 ? (
            <p className="text-slate-400 text-sm">No students assigned yet.</p>
          ) : (
            <div className="space-y-4">
              {items.map(({ student, percentage, risk }) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                        {`${student.profile?.first_name?.[0] ?? ''}${student.profile?.last_name?.[0] ?? ''}` || 'ST'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{student.profile?.first_name} {student.profile?.last_name}</p>
                      <p className="text-sm text-slate-400">{student.enrollment_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 hidden sm:block">
                      <Progress value={percentage} className="h-2 bg-slate-800" />
                    </div>
                    <span className="text-sm text-slate-400 w-10">{percentage}%</span>
                    <Badge className={`${getRiskColor(risk)} w-20 justify-center`}>{risk}</Badge>
                    <Button variant="ghost" size="icon" className="hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 border border-transparent hover:border-cyan-500/30" onClick={() => setMessagingStudent(student)}>
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
