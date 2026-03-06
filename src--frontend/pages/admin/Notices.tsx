import { useEffect, useState } from 'react';
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
import { noticeService, auditLogService } from '@/lib/api';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import type { Notice } from '@/lib/database.types';

export default function NoticesPage() {
  const { user } = useSupabaseAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    priority: 'MEDIUM' as Notice['priority'],
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await noticeService.getAll({ role: user?.role });
        setNotices(data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load notices');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.role]);

  const handleAddNotice = async () => {
    if (!newNotice.title || !newNotice.content) {
      toast.error('Title and content are required');
      return;
    }
    try {
      const created = await noticeService.create({
        title: newNotice.title,
        content: newNotice.content,
        priority: newNotice.priority,
        target_roles: [],
        target_departments: [],
        target_classes: [],
        is_pinned: false,
        is_active: true,
        published_by: user?.id ?? '',
      } as Partial<Notice>);
      if (created) setNotices((prev) => [created, ...prev]);
      setIsAddDialogOpen(false);
      setNewNotice({ title: '', content: '', priority: 'MEDIUM' });
      toast.success('Notice posted successfully');
      auditLogService.log('CREATE', 'notice', created?.id || '', { newValues: { title: newNotice.title } });
    } catch (err) {
      console.error(err);
      toast.error('Failed to post notice');
    }
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
                  onValueChange={(value: string) => setNewNotice({ ...newNotice, priority: value as typeof newNotice.priority })}
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
        {(loading ? [] : notices).map((notice) => (
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
                    <span>Posted on {new Date(notice.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      </div>
    </div>
  );
}