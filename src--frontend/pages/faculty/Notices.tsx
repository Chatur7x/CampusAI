import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bell, Plus, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { noticeService } from '@/lib/api';

export default function FacultyNoticesPage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', priority: 'MEDIUM' });

  const fetchNotices = async () => {
    try {
      const data = await noticeService.getAll({ role: 'FACULTY' });
      setNotices(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotices(); }, []);

  const handlePost = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setPosting(true);
    try {
      await noticeService.create({
        title: form.title,
        content: form.content,
        priority: form.priority as any,
      } as any);
      toast.success('Notice posted successfully');
      setOpen(false);
      setForm({ title: '', content: '', priority: 'MEDIUM' });
      setLoading(true);
      await fetchNotices();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post notice');
    } finally {
      setPosting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH': return 'bg-red-500/20 text-red-400';
      case 'MEDIUM': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-slate-400">Loading notices...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notices</h1>
          <p className="text-slate-400">Post announcements to your classes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Post Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Post a New Notice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Notice title"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Content</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                  placeholder="Notice content..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePost} disabled={posting} className="w-full bg-cyan-600 hover:bg-cyan-700">
                {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {posting ? 'Posting...' : 'Post Notice'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {notices.length === 0 && !error ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No notices yet. Post the first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notices.map((notice: any) => (
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
                      <span>Posted on {notice.createdAt?.slice(0, 10) || notice.created_at?.slice(0, 10) || 'Unknown'}</span>
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
      )}
    </div>
  );
}