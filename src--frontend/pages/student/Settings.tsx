import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Bell, Lock, Camera, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';

export default function StudentSettingsPage() {
  const { user, updateProfile, updatePassword } = useSupabaseAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(user?.profile?.first_name || '');
  const [lastName, setLastName] = useState(user?.profile?.last_name || '');
  const [phone, setPhone] = useState(user?.profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const faceRegistered = user?.student?.face_registered || false;

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
              <User className="w-5 h-5 text-emerald-400" />
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
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              Face Registration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-800/50 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                {faceRegistered ? (
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                ) : (
                  <Camera className="w-10 h-10 text-emerald-400" />
                )}
              </div>
              <p className="text-white font-medium mb-2">
                {faceRegistered ? 'Face Registered' : 'Face Not Registered'}
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {faceRegistered
                  ? 'Your face is registered for AI-powered attendance. You can re-register to update.'
                  : 'Register your face for AI-powered attendance marking'}
              </p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => navigate('/student/face-register')}
              >
                {faceRegistered ? 'Re-register Face' : 'Register Face'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-400" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Email Notifications</p>
                <p className="text-xs text-slate-400">Receive email alerts</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Attendance Alerts</p>
                <p className="text-xs text-slate-400">Get notified when attendance is marked</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Notice Updates</p>
                <p className="text-xs text-slate-400">Receive new notice notifications</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
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
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleChangePassword} disabled={changingPw}>
              {changingPw && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}