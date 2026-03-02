import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Calendar } from 'lucide-react';

const notices = [
  {
    id: '1',
    title: 'Mid-term Examination Schedule',
    content: 'The mid-term examinations will commence from March 15th. Please check your respective schedules and prepare accordingly.',
    priority: 'HIGH',
    date: '2024-03-01',
    category: 'Examination',
  },
  {
    id: '2',
    title: 'Campus Maintenance Notice',
    content: 'The main building will undergo maintenance this weekend. Classes will be held in alternate locations.',
    priority: 'MEDIUM',
    date: '2024-02-28',
    category: 'General',
  },
  {
    id: '3',
    title: 'New Library Hours',
    content: 'The library will now be open until 10 PM on weekdays. Weekend hours remain unchanged.',
    priority: 'LOW',
    date: '2024-02-25',
    category: 'Library',
  },
  {
    id: '4',
    title: 'Scholarship Application Deadline',
    content: 'Last date to apply for merit scholarships is March 10th. Submit your applications online.',
    priority: 'HIGH',
    date: '2024-02-24',
    category: 'Scholarship',
  },
];

export default function StudentNoticesPage() {
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
      <div>
        <h1 className="text-2xl font-bold text-white">Notices</h1>
        <p className="text-slate-400">Stay updated with campus announcements</p>
      </div>

      <div className="space-y-4">
        {notices.map((notice) => (
          <Card key={notice.id} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-emerald-500/20 text-emerald-400">{notice.category}</Badge>
                    <Badge className={getPriorityColor(notice.priority)}>{notice.priority}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{notice.title}</h3>
                  <p className="text-slate-400 mb-3">{notice.content}</p>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>Posted on {notice.date}</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center ml-4">
                  <Bell className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}