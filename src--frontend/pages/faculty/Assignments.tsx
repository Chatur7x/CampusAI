import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Plus, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FacultyAssignmentsPage() {
  const [open, setOpen] = useState(false);
  
  // Dummy data representing exactly the user's request example
  const [assignments, setAssignments] = useState([
    {
      id: 1,
      title: 'Database Design',
      deadline: '12 Oct 2026',
      submissions: 45,
      total: 60,
      course: 'DBMS (CSE-3A)'
    },
    {
      id: 2,
      title: 'Operating Systems - Memory Management',
      deadline: '15 Oct 2026',
      submissions: 12,
      total: 60,
      course: 'OS (CSE-3A)'
    }
  ]);

  const [form, setForm] = useState({ title: '', deadline: '', course: '', description: '' });

  const handlePost = () => {
    if (!form.title.trim()) {
      toast.error('Assignment title is required');
      return;
    }
    setAssignments([
      {
        id: Math.random(),
        title: form.title,
        deadline: form.deadline || 'No deadline',
        course: form.course || 'General',
        submissions: 0,
        total: 60
      },
      ...assignments
    ]);
    toast.success('Assignment uploaded successfully');
    setOpen(false);
    setForm({ title: '', deadline: '', course: '', description: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Assignments</h1>
          <p className="text-slate-400">Manage and upload class assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Upload Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Assignment Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g. Database Design"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Course / Class</Label>
                <Input
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g. DBMS (CSE-3A)"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Deadline</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Description / Instructions</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                  placeholder="Additional instructions..."
                />
              </div>
              <Button onClick={handlePost} className="w-full bg-cyan-600 hover:bg-cyan-700">
                Upload Assignment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignments.map((assignment) => {
          const completionPct = Math.round((assignment.submissions / assignment.total) * 100);
          return (
            <Card key={assignment.id} className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 mb-2">
                      {assignment.course}
                    </Badge>
                    <h3 className="text-lg font-bold text-white">{assignment.title}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm text-slate-300 gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    Deadline: <span className="text-emerald-300">{assignment.deadline}</span>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> Submissions</span>
                      <span className="text-white font-medium">{assignment.submissions} / {assignment.total}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full ${completionPct >= 80 ? 'bg-emerald-500' : completionPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${completionPct}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="pt-2 flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                      View Submissions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
