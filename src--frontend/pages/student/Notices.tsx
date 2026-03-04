import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { noticeService } from '@/lib/api';

export default function StudentNoticesPage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await noticeService.getAll({ role: 'STUDENT' });
        setNotices(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load notices');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="ml-3 text-slate-400">Loading notices...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notices</h1>
        <p className="text-slate-400">Stay updated with campus announcements</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {notices.length === 0 && !error ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No notices at the moment.</p>
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
                      {notice.category && <Badge className="bg-emerald-500/20 text-emerald-400">{notice.category}</Badge>}
                      <Badge className={getPriorityColor(notice.priority)}>{notice.priority}</Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{notice.title}</h3>
                    <p className="text-slate-400 mb-3">{notice.content}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span>Posted on {notice.createdAt?.slice(0, 10) || notice.created_at?.slice(0, 10) || 'Unknown'}</span>
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
      )}
    </div>
  );
}