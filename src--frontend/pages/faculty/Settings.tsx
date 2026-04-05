import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Bell, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';

export default function FacultySettingsPage() {
  const { user, updateProfile, updatePassword } = useSupabaseAuth();
  const [firstName, setFirstName] = useState(user?.profile?.first_name || '');
  const [lastName, setLastName] = useState(user?.profile?.last_name || '');
  const [phone, setPhone] = useState(user?.profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    attendance: true,
    leaves: true,
  });

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await updateProfile({ first_name: firstName, last_name: lastName, phone } as any);
      if (res?.success === false) throw new Error(res.error);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw) { toast.error('Please enter your current password'); return; }
    if (!newPw || newPw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setChangingPw(true);
    try {
      // Verify current password by re-authenticating
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user?.profile?.email || user?.email || '',
        password: currentPw,
      });
      if (signInErr) { toast.error('Current password is incorrect'); return; }
      const res = await updatePassword(newPw);
      if (res?.success === false) throw new Error(res.error);
      toast.success('Password updated successfully');
      setCurrentPw(''); setNewPw('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update password');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input value={user?.email || ''} disabled className="bg-slate-800 border-slate-700 text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-400" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Email Notifications</p>
                <p className="text-xs text-slate-400">Receive email alerts</p>
              </div>
              <Switch 
                checked={notifications.email} 
                onCheckedChange={(checked) => {
                  setNotifications(prev => ({ ...prev, email: checked }));
                  toast.success('Email notifications ' + (checked ? 'enabled' : 'disabled'));
                }} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Attendance Alerts</p>
                <p className="text-xs text-slate-400">Get notified about attendance</p>
              </div>
              <Switch 
                checked={notifications.attendance} 
                onCheckedChange={(checked) => {
                  setNotifications(prev => ({ ...prev, attendance: checked }));
                  toast.success('Attendance alerts ' + (checked ? 'enabled' : 'disabled'));
                }} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Leave Requests</p>
                <p className="text-xs text-slate-400">Notify on new leave requests</p>
              </div>
              <Switch 
                checked={notifications.leaves} 
                onCheckedChange={(checked) => {
                  setNotifications(prev => ({ ...prev, leaves: checked }));
                  toast.success('Leave request notifications ' + (checked ? 'enabled' : 'disabled'));
                }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Current Password</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">New Password</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={handleChangePassword} disabled={changingPw}>
              {changingPw && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}