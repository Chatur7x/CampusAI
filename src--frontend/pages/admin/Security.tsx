import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, AlertTriangle, CheckCircle, Shield, Activity, MapPin, Fingerprint, Key, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { securityService } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import MFASetup from '@/components/security/MFASetup';
import TrustedDevices from '@/components/security/TrustedDevices';
import LoginHistoryComponent from '@/components/security/LoginHistory';
import ActiveSessions from '@/components/security/ActiveSessions';
import type { SecurityAlert } from '@/lib/database.types';
import { toast } from 'sonner';

export default function SecurityPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [resolved, setResolved] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'devices' | 'history' | 'sessions' | 'mfa'>('overview');

  const fetchDashboardStats = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/security/dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) setDashboardStats(json.data);
    } catch (err) {
      console.error('Dashboard stats error:', err);
    }
  }, []);

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
      } finally {
        setLoading(false);
      }
    };
    load();
    fetchDashboardStats();
  }, [fetchDashboardStats]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-400" />
            Cybersecurity Center
          </h1>
          <p className="text-slate-400">Monitor, detect, and respond to security threats in real-time</p>
        </div>
        <Button variant="outline" size="sm" className="border-slate-600" onClick={fetchDashboardStats}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'overview', label: 'Overview', icon: Activity },
          { key: 'events', label: 'Security Events', icon: ShieldAlert },
          { key: 'devices', label: 'Devices', icon: Fingerprint },
          { key: 'history', label: 'Login History', icon: Clock },
          { key: 'sessions', label: 'Sessions', icon: Key },
          { key: 'mfa', label: 'MFA Setup', icon: Shield },
        ].map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeTab === key ? 'default' : 'outline'}
            size="sm"
            className={activeTab === key ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-600 text-slate-300'}
            onClick={() => setActiveTab(key as typeof activeTab)}
          >
            <Icon className="w-4 h-4 mr-1" /> {label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Critical Events</p>
                    <p className="text-2xl font-bold text-red-400">{dashboardStats?.criticalEvents ?? '…'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Open Events</p>
                    <p className="text-2xl font-bold text-amber-400">{dashboardStats?.openEvents ?? '…'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Failed Logins (24h)</p>
                    <p className="text-2xl font-bold text-red-400">{dashboardStats?.failedLogins24h ?? '…'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Successful Logins (24h)</p>
                    <p className="text-2xl font-bold text-emerald-400">{dashboardStats?.successfulLogins24h ?? '…'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs text-slate-400">GPS Spoof Detections (7d)</p>
                    <p className="text-xl font-bold text-purple-400">{dashboardStats?.spoofDetections7d ?? '…'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-xs text-slate-400">Trusted Devices</p>
                    <p className="text-xl font-bold text-cyan-400">{dashboardStats?.trustedDeviceCount ?? '…'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-400">Event Types (7d)</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(dashboardStats?.eventsByType || []).map((e: any) => (
                        <Badge key={e.type} className="bg-blue-500/10 text-blue-400 text-[10px]">{e.type}: {e.count}</Badge>
                      ))}
                      {(!dashboardStats?.eventsByType || dashboardStats.eventsByType.length === 0) && (
                        <span className="text-xs text-slate-500">No events</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Security Events */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Recent Security Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(dashboardStats?.recentEvents || []).slice(0, 10).map((evt: any) => (
                  <div key={evt.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${evt.severity === 'CRITICAL' ? 'bg-red-500' : evt.severity === 'HIGH' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-white">{evt.description}</p>
                        <p className="text-xs text-slate-400">{evt.eventType} · {evt.user?.email || 'Unknown'} · {new Date(evt.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${evt.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : evt.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {evt.severity}
                      </Badge>
                      {!evt.resolved && (
                        <Badge className="bg-slate-600/20 text-slate-400">Open</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {!dashboardStats?.recentEvents?.length && (
                  <p className="text-sm text-slate-500 text-center py-4">No recent security events — system is clean</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Legacy alerts (from Supabase security_alerts table) */}
          {alerts.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Security Alerts (Legacy)</CardTitle>
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
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Security Events Tab */}
      {activeTab === 'events' && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">All Security Events</CardTitle>
            <CardDescription className="text-slate-400">Automated incident detection and response log</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(dashboardStats?.recentEvents || []).map((evt: any) => (
                <div key={evt.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${evt.severity === 'CRITICAL' ? 'bg-red-500' : evt.severity === 'HIGH' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{evt.description}</p>
                      <p className="text-xs text-slate-400">
                        {evt.eventType} · {evt.user?.email || 'Unknown'} · {new Date(evt.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${evt.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : evt.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {evt.severity}
                  </Badge>
                </div>
              ))}
              {!dashboardStats?.recentEvents?.length && (
                <p className="text-sm text-slate-500 text-center py-4">No security events recorded</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && <TrustedDevices />}

      {/* Login History Tab */}
      {activeTab === 'history' && <LoginHistoryComponent />}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && <ActiveSessions />}

      {/* MFA Tab */}
      {activeTab === 'mfa' && <MFASetup userId="" mfaEnabled={false} />}
    </div>
  );
}