import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  isActive: boolean;
}

const mockNotices: Notice[] = [
  {
    id: '1',
    title: 'Mid-term Examination Schedule',
    content: 'The mid-term examinations will commence from March 15th. Please check your respective schedules.',
    priority: 'HIGH',
    createdAt: '2024-03-01',
    isActive: true,
  },
  {
    id: '2',
    title: 'Campus Maintenance Notice',
    content: 'The main building will undergo maintenance this weekend. Classes will be held in alternate locations.',
    priority: 'MEDIUM',
    createdAt: '2024-02-28',
    isActive: true,
  },
  {
    id: '3',
    title: 'New Library Hours',
    content: 'The library will now be open until 10 PM on weekdays.',
    priority: 'LOW',
    createdAt: '2024-02-25',
    isActive: true,
  },
];

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>(mockNotices);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    priority: 'MEDIUM' as const,
  });

  const handleAddNotice = () => {
    const notice: Notice = {
      id: Date.now().toString(),
      ...newNotice,
      createdAt: new Date().toISOString().split('T')[0],
      isActive: true,
    };
    setNotices([notice, ...notices]);
    setIsAddDialogOpen(false);
    setNewNotice({ title: '', content: '', priority: 'MEDIUM' });
    toast.success('Notice posted successfully');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-500/20 text-red-400';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400';
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
          <p className="text-slate-400">Manage campus announcements</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Plus className="w-4 h-4 mr-2" />
              Post Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Post New Notice</DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a new announcement for the campus
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Title</Label>
                <Input
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter notice title"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Content</Label>
                <Textarea
                  value={newNotice.content}
                  onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                  placeholder="Enter notice content"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Priority</Label>
                <Select
                  value={newNotice.priority}
                  onValueChange={(value: any) => setNewNotice({ ...newNotice, priority: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNotice} className="bg-violet-600 hover:bg-violet-700">
                Post Notice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                    <span>Posted on {notice.createdAt}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}