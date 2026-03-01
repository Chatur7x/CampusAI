import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { securityService } from '@/lib/api';
import type { SecurityAlert } from '@/lib/database.types';
import { toast } from 'sonner';

export default function SecurityPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [resolved, setResolved] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [openAlerts, resolvedAlerts] = await Promise.all([
          securityService.getAlerts(false),
          securityService.getAlerts(true),
        ]);
        setAlerts(openAlerts ?? []);
        setResolved(resolvedAlerts ?? []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load security alerts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const counts = useMemo(() => {
    const critical = alerts.filter((a) => (a.severity || '').toUpperCase() === 'CRITICAL').length;
    const warning = alerts.filter((a) => (a.severity || '').toUpperCase() === 'MEDIUM' || (a.severity || '').toUpperCase() === 'HIGH').length;
    const resolvedCount = resolved.length;
    return { critical, warning, resolved: resolvedCount };
  }, [alerts, resolved]);

  const severityBadge = (severity?: string) => {
    const sev = (severity || '').toUpperCase();
    if (sev === 'CRITICAL' || sev === 'HIGH') return 'bg-red-500/20 text-red-400';
    if (sev === 'MEDIUM') return 'bg-amber-500/20 text-amber-400';
    return 'bg-emerald-500/20 text-emerald-300';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Security Monitoring</h1>
        <p className="text-slate-400">Monitor security alerts and anomalies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-400">{loading ? '…' : counts.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Warnings</p>
                <p className="text-2xl font-bold text-amber-400">{loading ? '…' : counts.warning}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Resolved</p>
                <p className="text-2xl font-bold text-emerald-400">{loading ? '…' : counts.resolved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Security Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${severityBadge(alert.severity).includes('red') ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{alert.title}</p>
                    <p className="text-xs text-slate-400">{alert.description}</p>
                    <p className="text-[11px] text-slate-500">{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <Badge className={severityBadge(alert.severity)}>{alert.severity}</Badge>
              </div>
            ))}
            {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}