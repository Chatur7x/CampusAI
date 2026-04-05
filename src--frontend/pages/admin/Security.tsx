import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShieldAlert, Shield, Activity, 
  MapPin, Key, Clock, RefreshCw, AlertOctagon,
  TrendingUp, Globe, Smartphone, UserX, Info, ExternalLink,
  Search, ShieldCheck, Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { securityService } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import MFASetup from '@/components/security/MFASetup';
import TrustedDevices from '@/components/security/TrustedDevices';
import LoginHistoryComponent from '@/components/security/LoginHistory';
import { motion, AnimatePresence } from 'framer-motion';
import type { SecurityAlert } from '@/lib/database.types';

export default function SecurityPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [resolved, setResolved] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'fraud' | 'events' | 'devices' | 'history' | 'mfa'>('overview');

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
    return { critical, warning, resolved: resolved.length };
  }, [alerts, resolved]);

  const stats = [
    { label: 'Critical Threats', value: dashboardStats?.criticalEvents ?? counts.critical, icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Open Issues', value: dashboardStats?.openEvents ?? counts.warning, icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Failed Logins', value: dashboardStats?.failedLogins24h ?? '0', icon: Key, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Secured Sessions', value: dashboardStats?.activeSessionCount ?? '0', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  ];

  return (
    <div className="space-y-8 min-h-screen pb-20">
      {/* Header with Glassmorphism */}
      <div className="relative overflow-hidden rounded-[2rem] border border-blue-500/20 bg-slate-900/40 p-8 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -m-20 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Cybersecurity Center</h1>
                <p className="text-slate-400 font-medium">Proactive threat intelligence & identity defense</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 text-xs font-bold">
               SYSTEM SHIELD: ACTIVE
             </Badge>
             <Button variant="outline" className="border-slate-700 bg-slate-900/50 hover:bg-slate-800" onClick={fetchDashboardStats}>
               <RefreshCw className="w-4 h-4 mr-2" /> Synch Intel
             </Button>
          </div>
        </div>
      </div>

      {/* Navigation - Futuristic Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-950/40 rounded-2xl border border-slate-800 overflow-x-auto max-w-fit">
        {[
          { key: 'overview', label: 'Monitor', icon: Activity },
          { key: 'fraud', label: 'Fraud Intel', icon: Zap },
          { key: 'events', label: 'Incident Log', icon: Info },
          { key: 'devices', label: 'Device Trust', icon: Smartphone },
          { key: 'history', label: 'Audit Trail', icon: Clock },
          { key: 'mfa', label: 'Identity/MFA', icon: Key },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === key 
                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* High Level Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <Card key={i} className="bg-slate-900/40 border-slate-800 backdrop-blur-md hover:border-slate-700 transition-all group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-xl ${s.bg} group-hover:scale-110 transition-transform`}>
                        <s.icon className={`w-6 h-6 ${s.color}`} />
                      </div>
                      <Badge className="bg-slate-800/50 text-[10px] text-slate-500 border-none">LIVE</Badge>
                    </div>
                    <p className="text-3xl font-black text-white">{loading ? '...' : s.value}</p>
                    <p className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-wider">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-slate-900/40 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Real-time Identity Threats</CardTitle>
                    <CardDescription>Live feed of security events detected by AI server</CardDescription>
                  </div>
                  <TrendingUp className="text-blue-500 w-5 h-5 opacity-50" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(dashboardStats?.recentEvents || []).slice(0, 6).map((evt: any) => (
                      <div key={evt.id} className="group relative overflow-hidden p-4 rounded-2xl bg-slate-950/40 border border-slate-800 hover:border-blue-500/30 transition-all">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                               evt.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500/20' : 
                               evt.severity === 'HIGH' ? 'bg-amber-500/10 border-amber-500/20' : 
                               'bg-blue-500/10 border-blue-500/20'
                             }`}>
                               {evt.eventType === 'IMPOSSIBLE_TRAVEL' ? <Globe className="w-5 h-5 text-blue-400" /> :
                                evt.eventType === 'SUSPICIOUS_DEVICE' ? <Smartphone className="w-5 h-5 text-purple-400" /> :
                                <ShieldAlert className="w-5 h-5 text-red-400" />}
                             </div>
                             <div>
                               <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{evt.description}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <Badge className="text-[10px] bg-slate-800 text-slate-400 border-none h-5">{evt.eventType}</Badge>
                                 <span className="text-[10px] text-slate-500 font-mono uppercase">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                               </div>
                             </div>
                          </div>
                          <Badge className={`${
                            evt.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 
                            evt.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-500' : 
                            'bg-blue-500/20 text-blue-500'
                          } border-none font-black`}>
                            {evt.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {!dashboardStats?.recentEvents?.length && (
                      <div className="py-20 text-center space-y-3 opacity-50">
                        <ShieldCheck className="w-12 h-12 mx-auto text-slate-600" />
                        <p className="text-sm font-medium">Zero current incidents detected</p>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" className="w-full mt-4 text-xs font-bold text-slate-500 hover:text-white" onClick={() => setActiveTab('events')}>
                    VIEW FULL INCIDENT LOG <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-slate-900/40 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Device Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Trusted Hardware</span>
                      <span className="text-white font-bold">{dashboardStats?.trustedDeviceCount ?? 0}</span>
                    </div>
                    <Progress value={85} className="h-2 bg-slate-800" />
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Legacy Profiles</span>
                      <span className="text-white font-bold">12</span>
                    </div>
                    <Progress value={15} className="h-2 bg-slate-800" />
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-blue-500/30 overflow-hidden relative">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                   <CardContent className="p-6">
                     <h4 className="font-black text-white text-lg mb-2">AI Shield Pro</h4>
                     <p className="text-xs text-blue-200/70 leading-relaxed mb-4">
                       FastAPI server is running enhanced fraud detecting algorithms including 
                       <strong>Impossible Travel</strong> and <strong>Isolation Forest</strong> behavior analysis.
                     </p>
                     <div className="flex items-center gap-2">
                       <div className="flex -space-x-2">
                         {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900" />)}
                       </div>
                       <span className="text-[10px] font-bold text-blue-400 uppercase">3 Nodes Defending</span>
                     </div>
                   </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'fraud' && (
          <motion.div 
            key="fraud"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/40 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" /> Impossible Travel Logs
                  </CardTitle>
                  <CardDescription>Detections of geographically impossible login attempts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(dashboardStats?.recentEvents || []).filter((e: any) => e.eventType === 'IMPOSSIBLE_TRAVEL').map((evt: any) => (
                      <div key={evt.id} className="p-5 rounded-2xl bg-slate-950/60 border-l-4 border-l-red-500 shadow-xl">
                        <div className="flex justify-between items-start mb-3">
                          <h5 className="font-bold text-white">{evt.user?.name || 'Student ID: ' + evt.userId}</h5>
                          <Badge className="bg-red-500/20 text-red-500 border-none px-2 py-0">ALARM</Badge>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">{evt.description}</p>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                             <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Impacted Location</p>
                             <p className="text-xs text-slate-200 flex items-center gap-1"><MapPin className="w-3 h-3 text-red-400" /> {evt.metadata?.city || 'Remote IP'}</p>
                           </div>
                           <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                             <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Velocity Checked</p>
                             <p className="text-xs text-slate-200 font-mono">{evt.metadata?.distance_km?.toFixed(0) || 'N/A'} KM / {evt.metadata?.time_diff_min?.toFixed(0) || 'N/A'} MIN</p>
                           </div>
                        </div>
                      </div>
                    ))}
                    {!dashboardStats?.recentEvents?.some((e: any) => e.eventType === 'IMPOSSIBLE_TRAVEL') && (
                      <div className="py-12 bg-slate-950/20 rounded-2xl border border-dashed border-slate-800 text-center">
                        <p className="text-slate-500 font-medium">No velocity anomalies detected recently</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-slate-900/40 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">Fraud Analytics Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-40 h-40 rounded-full border-8 border-slate-800 border-t-blue-500 border-r-purple-500 animate-spin-slow" />
                      <div className="absolute inset-x-0 inset-y-0 flex flex-col items-center justify-center">
                        <p className="text-2xl font-black text-white">4%</p>
                        <p className="text-[10px] text-slate-500 uppercase font-black">Risk Ratio</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/40 border-slate-800">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <UserX className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-white">Identity Lock</p>
                        <p className="text-xs text-slate-500">Auto-locks accounts with &gt;90% risk score</p>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-none px-3 font-black">ENABLED</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {/* Other Tabs (Simplified placeholders or components) */}
        {activeTab === 'events' && (
           <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
             <Card className="bg-slate-900/40 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white">Complete Security Audit</CardTitle>
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input className="pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-64" placeholder="Filter incidents..." />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(dashboardStats?.recentEvents || []).map((evt: any) => (
                      <div key={evt.id} className="grid grid-cols-12 gap-4 p-4 items-center border-b border-slate-800/50 hover:bg-slate-800/20 transition-all rounded-lg">
                        <div className="col-span-1 flex justify-center">
                          <div className={`w-2 h-2 rounded-full ${evt.severity === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-slate-600'}`} />
                        </div>
                        <div className="col-span-3">
                          <p className="text-xs font-bold text-white uppercase">{evt.eventType}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{new Date(evt.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="col-span-6">
                          <p className="text-xs text-slate-300 line-clamp-1">{evt.description}</p>
                        </div>
                        <div className="col-span-2 text-right">
                           <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">DETAIL</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
             </Card>
           </motion.div>
        )}

        {activeTab === 'devices' && <TrustedDevices />}
        {activeTab === 'history' && <LoginHistoryComponent />}
        {activeTab === 'mfa' && <MFASetup userId="" mfaEnabled={false} />}
      </AnimatePresence>
    </div>
  );
}