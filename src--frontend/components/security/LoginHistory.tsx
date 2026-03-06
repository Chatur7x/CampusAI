import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, MapPin, CheckCircle, XCircle, Lock, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LoginEntry {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
  location?: { lat: number; lng: number; city?: string; country?: string };
}

export default function LoginHistoryComponent() {
  const [history, setHistory] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/security/login-history?limit=20', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) setHistory(json.data || []);
    } catch (err) {
      toast.error('Failed to load login history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'locked': return <Lock className="w-4 h-4 text-amber-400" />;
      case 'mfa_required': return <Shield className="w-4 h-4 text-blue-400" />;
      default: return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-500/20 text-emerald-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      case 'locked': return 'bg-amber-500/20 text-amber-400';
      case 'mfa_required': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const parseBrowser = (ua: string | null) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return 'Other';
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          Login History
        </CardTitle>
        <CardDescription className="text-slate-400">
          Recent sign-in activity for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No login history available</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(entry.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {parseBrowser(entry.userAgent)}
                      </span>
                      <Badge className={statusBadge(entry.status)}>{entry.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500">
                        IP: {entry.ipAddress || 'N/A'}
                      </span>
                      {entry.location?.city && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {entry.location.city}
                        </span>
                      )}
                      {entry.failureReason && (
                        <span className="text-[11px] text-red-400">{entry.failureReason}</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
