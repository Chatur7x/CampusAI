import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export default function ResetPasswordPage() {
  const { updatePassword } = useSupabaseAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await updatePassword(password);
      if (res?.success === false) throw new Error(res.error);
      setDone(true);
      toast.success('Password reset successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              {done ? (
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              ) : (
                <Lock className="w-8 h-8 text-emerald-400" />
              )}
            </div>
            <CardTitle className="text-white text-xl">
              {done ? 'Password Reset Complete' : 'Reset Your Password'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-4 text-center">
                <p className="text-slate-400 text-sm">
                  Your password has been successfully reset. You can now log in with your new password.
                </p>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">New Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Confirm new password"
                  />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleReset}
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Reset Password
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-slate-400"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
