import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Smartphone, Key, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface MFASetupProps {
  userId: string;
  mfaEnabled: boolean;
  onMFAChange?: (enabled: boolean) => void;
}

export default function MFASetup({ userId, mfaEnabled, onMFAChange }: MFASetupProps) {
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'backup'>('idle');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const startSetup = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Not authenticated'); return; }

      const res = await fetch('/api/auth/setup-mfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message || 'Failed to start MFA setup'); return; }

      setSecret(json.data.secret);
      setBackupCodes(json.data.backupCodes || []);
      setStep('setup');
    } catch (err) {
      toast.error('Failed to initialize MFA');
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOTP = useCallback(async () => {
    if (otp.length < 6) { toast.error('Enter a 6-digit code'); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Not authenticated'); return; }

      const res = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, otp }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message || 'Invalid OTP'); return; }

      toast.success('MFA enabled successfully!');
      setStep('backup');
      onMFAChange?.(true);
    } catch (err) {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  }, [otp, userId, onMFAChange]);

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('All backup codes copied');
  };

  // Already enabled state
  if (mfaEnabled && step === 'idle') {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <div>
              <CardTitle className="text-white">Two-Factor Authentication</CardTitle>
              <CardDescription className="text-slate-400">Your account is protected with MFA</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400">Enabled</Badge>
              <span className="text-sm text-slate-400">Email OTP verification active</span>
            </div>
            <Button variant="outline" size="sm" className="border-red-600/50 text-red-400 hover:bg-red-600/10">
              Disable MFA
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Setup flow
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <div>
            <CardTitle className="text-white">Two-Factor Authentication</CardTitle>
            <CardDescription className="text-slate-400">
              {step === 'idle' && 'Add an extra layer of security to your account'}
              {step === 'setup' && 'Save your secret key and verify with OTP'}
              {step === 'verify' && 'Enter the verification code'}
              {step === 'backup' && 'Save your backup codes — you will need them if you lose access'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'idle' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">How it works</p>
                  <p className="text-xs text-slate-400">
                    After enabling MFA, you'll receive a one-time code via email each time you log in.
                    This prevents unauthorized access even if your password is compromised.
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={startSetup} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Enable Two-Factor Authentication
            </Button>
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-400 mb-2">Your MFA Secret Key (for authenticator apps)</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-white bg-slate-800 px-3 py-2 rounded flex-1 overflow-hidden text-ellipsis">
                  {secret}
                </code>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(secret); toast.success('Secret copied'); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                <p className="text-xs text-amber-400">
                  An OTP has been sent to your email. Enter it below to verify and activate MFA.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="bg-slate-800 border-slate-700 text-white text-center text-lg tracking-widest"
              />
              <Button onClick={verifyOTP} disabled={loading || otp.length < 6} className="bg-emerald-600 hover:bg-emerald-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-start gap-2">
                <Key className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-xs text-red-400">
                  Save these backup codes in a safe place. Each code can only be used once.
                  If you lose access to your email AND these codes, you'll be locked out.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded bg-slate-800 border border-slate-700"
                >
                  <code className="text-sm font-mono text-white">{code}</code>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyCode(code, i)}>
                    {copiedIndex === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={copyAllCodes} className="flex-1 border-slate-600">
                <Copy className="w-4 h-4 mr-2" /> Copy All Codes
              </Button>
              <Button onClick={() => setStep('idle')} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Done
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
