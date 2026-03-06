import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, Trash2, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Session {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/security/sessions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) setSessions(json.data || []);
    } catch (err) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/security/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success('Session revoked');
      fetchSessions();
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const revokeAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/security/sessions/revoke-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ keepCurrent: true }),
      });
      toast.success('All other sessions revoked');
      fetchSessions();
    } catch {
      toast.error('Failed to revoke sessions');
    }
  };

  const parseBrowser = (ua: string | null) => {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Edg')) return 'Microsoft Edge';
    if (ua.includes('Chrome')) return 'Google Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return 'Unknown Browser';
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Wifi className="w-5 h-5 text-cyan-400" />
              Active Sessions
            </CardTitle>
            <CardDescription className="text-slate-400">
              Devices currently signed into your account
            </CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button size="sm" variant="outline" className="border-red-600/50 text-red-400 hover:bg-red-600/10" onClick={revokeAll}>
              <LogOut className="w-3 h-3 mr-1" /> Sign Out Others
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No active sessions</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                    <Wifi className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{parseBrowser(s.deviceInfo)}</span>
                      {i === 0 && <Badge className="bg-cyan-500/20 text-cyan-400 text-[10px]">Current</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      IP: {s.ipAddress || 'N/A'} · Started: {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {i !== 0 && (
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => revokeSession(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
