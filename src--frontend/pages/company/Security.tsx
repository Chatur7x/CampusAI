import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Shield, ShieldAlert, ShieldCheck, Users, AlertTriangle,
  Lock, Eye, Clock, CheckCircle, XCircle, Bell
} from 'lucide-react';

const securityEvents = [
  { id: 1, type: 'login', severity: 'low', message: 'Successful login from new device', user: 'john@google.com', time: '2 min ago', ip: '192.168.1.1' },
  { id: 2, type: 'permission', severity: 'medium', message: 'Elevated permissions requested', user: 'sarah@google.com', time: '15 min ago', ip: '10.0.0.5' },
  { id: 3, type: 'access', severity: 'high', message: 'Failed login attempt (3x)', user: 'unknown', time: '1 hour ago', ip: '45.33.32.156' },
  { id: 4, type: 'data', severity: 'medium', message: 'Bulk data export initiated', user: 'mike@google.com', time: '2 hours ago', ip: '192.168.1.10' },
  { id: 5, type: 'access', severity: 'low', message: 'Sensitive file accessed', user: 'emily@google.com', time: '3 hours ago', ip: '10.0.0.8' },
];

const accessControls = [
  { name: 'Two-Factor Authentication', enabled: true, description: 'Require 2FA for all users' },
  { name: 'IP Whitelist', enabled: true, description: 'Restrict access to approved IPs' },
  { name: 'Session Timeout', enabled: true, description: 'Auto-logout after 30 min inactivity' },
  { name: 'Data Encryption', enabled: true, description: 'Encrypt sensitive data at rest' },
  { name: 'Audit Logging', enabled: true, description: 'Log all user actions' },
  { name: 'API Rate Limiting', enabled: false, description: 'Limit API requests per minute' },
];

const getSeverityBadge = (severity: string) => {
  switch (severity) {
    case 'high':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <AlertTriangle className="w-3 h-3 mr-1" /> High
      </Badge>;
    case 'medium':
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
        <Clock className="w-3 h-3 mr-1" /> Medium
      </Badge>;
    default:
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
        <ShieldCheck className="w-3 h-3 mr-1" /> Low
      </Badge>;
  }
};

export default function CompanySecurity() {
  const { theme } = useTheme();
  const [controls, setControls] = useState(accessControls);

  const toggleControl = (index: number) => {
    const newControls = [...controls];
    newControls[index].enabled = !newControls[index].enabled;
    setControls(newControls);
  };

  const highSeverityCount = securityEvents.filter(e => e.severity === 'high').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Security
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Monitor and manage security settings
          </p>
        </div>
        <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost border-red-500/30 text-red-400' : 'border-red-300 text-red-600'}>
          <ShieldAlert className="w-4 h-4 mr-2" />
          Run Security Scan
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <Shield className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold text-emerald-400">98%</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Security Score</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold text-emerald-400">247</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Passed Checks</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold text-amber-400">{highSeverityCount}</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Warnings</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <Lock className="w-8 h-8 mx-auto mb-2 text-violet-400" />
            <p className="text-2xl font-bold text-violet-400">6</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Access Controls</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Recent Security Events
          </h2>
          <div className="space-y-4">
            {securityEvents.map((event) => (
              <Card key={event.id} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getSeverityBadge(event.severity)}
                        <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                          {event.message}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        <span>{event.user}</span>
                        <span>|</span>
                        <span>{event.ip}</span>
                        <span>|</span>
                        <span>{event.time}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-white/50 hover:text-white">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Access Controls
          </h2>
          <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-4">
              <div className="space-y-4">
                {controls.map((control, index) => (
                  <div key={control.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        control.enabled 
                          ? 'bg-emerald-500/20' 
                          : 'bg-slate-500/20'
                      }`}>
                        {control.enabled ? (
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Shield className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                          {control.name}
                        </p>
                        <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                          {control.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleControl(index)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        control.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        control.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
