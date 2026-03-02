import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const notices = [
  {
    id: '1',
    title: 'Assignment Submission Deadline',
    content: 'Please submit your assignments by Friday.',
    priority: 'HIGH',
    date: '2024-03-01',
  },
  {
    id: '2',
    title: 'Class Rescheduled',
    content: 'Tomorrow\'s class will be held in Room 305.',
    priority: 'MEDIUM',
    date: '2024-02-28',
  },
];

export default function FacultyNoticesPage() {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-500/20 text-red-400';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notices</h1>
          <p className="text-slate-400">Post announcements to your classes</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => toast.info('Feature coming soon')}>
          <Plus className="w-4 h-4 mr-2" />
          Post Notice
        </Button>
      </div>

      <div className="space-y-4">
        {notices.map((notice) => (
          <Card key={notice.id} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-white">{notice.title}</h3>
                    <Badge className={getPriorityColor(notice.priority)}>{notice.priority}</Badge>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{notice.content}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    <span>Posted on {notice.date}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}