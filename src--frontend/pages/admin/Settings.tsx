import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Database } from 'lucide-react';
import { toast } from 'sonner';
import { settingsService } from '@/lib/api';

type SettingState = {
  institution_name: string;
  contact_email: string;
  email_notifications: boolean;
  push_notifications: boolean;
  attendance_alerts: boolean;
  enforce_2fa: boolean;
  face_required: boolean;
  session_timeout: number;
  min_attendance: number;
  late_threshold: number;
  auto_mark_absent: boolean;
};

const defaults: SettingState = {
  institution_name: 'CampusAI University',
  contact_email: 'admin@campusai.edu',
  email_notifications: true,
  push_notifications: true,
  attendance_alerts: false,
  enforce_2fa: true,
  face_required: true,
  session_timeout: 30,
  min_attendance: 75,
  late_threshold: 15,
  auto_mark_absent: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingState>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await settingsService.getAll();
        const map: SettingState = { ...defaults };
        (data || []).forEach((s: { key: string; value: string }) => {
          const key = s.key as keyof SettingState;
          if (key in map) {
            const raw = s.value;
            const boolVal = raw === 'true' ? true : raw === 'false' ? false : undefined;
            const numVal = Number(raw);
            const parsed = boolVal ?? (Number.isNaN(numVal) ? raw : numVal);
            (map as any)[key] = parsed;
          }
        });
        setSettings(map);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveSetting = async (key: keyof SettingState, value: string | number | boolean) => {
    await settingsService.set(String(key), String(value));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Promise.all(Object.entries(settings).map(([k, v]) => saveSetting(k as keyof SettingState, v)));
      toast.success('Settings saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof SettingState>(key: K, value: SettingState[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

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
                value={settings.institution_name}
                onChange={(e) => update('institution_name', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Contact Email</Label>
              <Input
                value={settings.contact_email}
                onChange={(e) => update('contact_email', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save Changes'}
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
            <ToggleRow
              title="Email Notifications"
              description="Send email alerts for important events"
              checked={settings.email_notifications}
              onChange={(v) => update('email_notifications', v)}
            />
            <ToggleRow
              title="Push Notifications"
              description="Send push notifications to mobile devices"
              checked={settings.push_notifications}
              onChange={(v) => update('push_notifications', v)}
            />
            <ToggleRow
              title="Attendance Alerts"
              description="Notify when attendance is marked"
              checked={settings.attendance_alerts}
              onChange={(v) => update('attendance_alerts', v)}
            />
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
            <ToggleRow
              title="Two-Factor Authentication"
              description="Require 2FA for all users"
              checked={settings.enforce_2fa}
              onChange={(v) => update('enforce_2fa', v)}
            />
            <ToggleRow
              title="Face Recognition"
              description="Enable AI face verification"
              checked={settings.face_required}
              onChange={(v) => update('face_required', v)}
            />
            <div className="space-y-2">
              <Label className="text-slate-300">Session Timeout (minutes)</Label>
              <Input
                type="number"
                value={settings.session_timeout}
                onChange={(e) => update('session_timeout', Number(e.target.value))}
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
                value={settings.min_attendance}
                onChange={(e) => update('min_attendance', Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Late Threshold (minutes)</Label>
              <Input
                type="number"
                value={settings.late_threshold}
                onChange={(e) => update('late_threshold', Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <ToggleRow
              title="Auto-mark Absent"
              description="Automatically mark absent after threshold"
              checked={settings.auto_mark_absent}
              onChange={(v) => update('auto_mark_absent', v)}
            />
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-slate-500">{loading ? 'Loading settings…' : 'Loaded from Supabase system_settings'}</p>
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void; }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}