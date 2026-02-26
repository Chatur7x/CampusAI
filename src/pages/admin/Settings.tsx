import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Database } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">Configure system settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-violet-400" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Institution Name</Label>
              <Input
                defaultValue="CampusAI University"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Contact Email</Label>
              <Input
                defaultValue="admin@campusai.edu"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => toast.success('Settings saved')}>
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-400" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Email Notifications</p>
                <p className="text-xs text-slate-400">Send email alerts for important events</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Push Notifications</p>
                <p className="text-xs text-slate-400">Send push notifications to mobile devices</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Attendance Alerts</p>
                <p className="text-xs text-slate-400">Notify when attendance is marked</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Two-Factor Authentication</p>
                <p className="text-xs text-slate-400">Require 2FA for all users</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Face Recognition</p>
                <p className="text-xs text-slate-400">Enable AI face verification</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Session Timeout (minutes)</Label>
              <Input
                type="number"
                defaultValue="30"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              Attendance Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Minimum Attendance %</Label>
              <Input
                type="number"
                defaultValue="75"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Late Threshold (minutes)</Label>
              <Input
                type="number"
                defaultValue="15"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Auto-mark Absent</p>
                <p className="text-xs text-slate-400">Automatically mark absent after threshold</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}