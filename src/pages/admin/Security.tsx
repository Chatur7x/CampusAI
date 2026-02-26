import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SecurityPage() {
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
                <p className="text-2xl font-bold text-red-400">3</p>
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
                <p className="text-2xl font-bold text-amber-400">7</p>
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
                <p className="text-2xl font-bold text-emerald-400">24</p>
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
            <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-white">Face Mismatch Detected</p>
                  <p className="text-xs text-slate-400">Student ID: STU2024001 • 2 min ago</p>
                </div>
              </div>
              <Badge className="bg-red-500/20 text-red-400">Critical</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <div>
                  <p className="text-sm font-medium text-white">Suspicious Login Attempt</p>
                  <p className="text-xs text-slate-400">IP: 192.168.1.100 • 15 min ago</p>
                </div>
              </div>
              <Badge className="bg-amber-500/20 text-amber-400">Warning</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-orange-500/5 border border-orange-500/10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <div>
                  <p className="text-sm font-medium text-white">Geo-location Anomaly</p>
                  <p className="text-xs text-slate-400">Location: Outside campus • 1 hour ago</p>
                </div>
              </div>
              <Badge className="bg-orange-500/20 text-orange-400">Medium</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}