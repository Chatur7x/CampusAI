import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import type { UserRole } from '@/types';
import { GraduationCap, Users, Shield, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const roleConfig: Record<string, { label: string; color: string; gradient: string; email: string }> = {
  STUDENT: {
    label: 'Student',
    color: 'text-emerald-500',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    email: 'student@campus.edu',
  },
  FACULTY: {
    label: 'Faculty',
    color: 'text-cyan-500',
    gradient: 'from-cyan-500/20 to-blue-500/20',
    email: 'faculty@campus.edu',
  },
  ADMIN: {
    label: 'Admin',
    color: 'text-violet-500',
    gradient: 'from-violet-500/20 to-purple-500/20',
    email: 'admin@campus.edu',
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyMFA } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('STUDENT');
  const [email, setEmail] = useState('student@campus.edu');
  const [password, setPassword] = useState('password');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [requireMFA, setRequireMFA] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');

  // Auto-fill credentials when role changes
  useEffect(() => {
    setEmail(roleConfig[selectedRole].email);
    setPassword('password');
  }, [selectedRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password, selectedRole);

    if (result.success) {
      if (result.requireMFA) {
        setRequireMFA(true);
        setMfaUserId(result.userId || '');
        toast.info('Please enter the OTP sent to your email');
      } else {
        toast.success('Login successful!');
        navigate('/');
      }
    } else {
      setError(result.message || 'Login failed');
      toast.error(result.message || 'Login failed');
    }

    setIsLoading(false);
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await verifyMFA(mfaUserId, otp);

    if (result.success) {
      toast.success('MFA verification successful!');
      navigate('/');
    } else {
      setError(result.message || 'MFA verification failed');
      toast.error(result.message || 'MFA verification failed');
    }

    setIsLoading(false);
  };

  const quickLogin = (role: UserRole) => {
    setSelectedRole(role);
    setEmail(roleConfig[role].email);
    setPassword('password');
    toast.info(`Selected ${roleConfig[role].label} role. Click Sign In to continue.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background Gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border-slate-800 relative z-10 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-white">CampusAI</CardTitle>
          <CardDescription className="text-slate-400 mt-2">
            Academic Management & Smart Attendance Platform
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {error && (
            <Alert variant="destructive" className="mb-4 bg-red-500/10 border-red-500/20">
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          {!requireMFA ? (
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Quick Role Selection */}
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Select Your Role</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['STUDENT', 'FACULTY', 'ADMIN'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => quickLogin(role as UserRole)}
                      className={`p-3 rounded-xl border transition-all duration-200 ${
                        selectedRole === role
                          ? role === 'STUDENT'
                            ? 'bg-emerald-500/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                            : role === 'FACULTY'
                            ? 'bg-cyan-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                            : 'bg-violet-500/20 border-violet-500/50 shadow-lg shadow-violet-500/10'
                          : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {role === 'STUDENT' && <GraduationCap className={`w-5 h-5 ${selectedRole === role ? 'text-emerald-400' : 'text-slate-400'}`} />}
                        {role === 'FACULTY' && <Users className={`w-5 h-5 ${selectedRole === role ? 'text-cyan-400' : 'text-slate-400'}`} />}
                        {role === 'ADMIN' && <Shield className={`w-5 h-5 ${selectedRole === role ? 'text-violet-400' : 'text-slate-400'}`} />}
                        <span className={`text-xs font-medium ${selectedRole === role ? 'text-white' : 'text-slate-400'}`}>
                          {roleConfig[role].label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Role Display */}
              <div className={`p-4 rounded-xl bg-gradient-to-r ${roleConfig[selectedRole].gradient} border border-slate-700/50`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900/50 flex items-center justify-center">
                    {selectedRole === 'STUDENT' && <GraduationCap className="w-5 h-5 text-emerald-400" />}
                    {selectedRole === 'FACULTY' && <Users className="w-5 h-5 text-cyan-400" />}
                    {selectedRole === 'ADMIN' && <Shield className="w-5 h-5 text-violet-400" />}
                  </div>
                  <div>
                    <p className={`font-semibold ${roleConfig[selectedRole].color}`}>
                      {roleConfig[selectedRole].label} Portal
                    </p>
                    <p className="text-xs text-slate-400">
                      Access your {roleConfig[selectedRole].label.toLowerCase()} dashboard
                    </p>
                  </div>
                  <ArrowRight className={`w-5 h-5 ml-auto ${roleConfig[selectedRole].color}`} />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className={`w-full h-12 text-base font-semibold bg-gradient-to-r ${
                  selectedRole === 'STUDENT'
                    ? 'from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20'
                    : selectedRole === 'FACULTY'
                    ? 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/20'
                    : 'from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/20'
                } transition-all duration-200`}
              >
                {isLoading ? (
                  <>
                    <Spinner className="w-5 h-5 mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in as {roleConfig[selectedRole].label}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              {/* Demo Credentials Box */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-xs text-slate-400 text-center mb-2">Demo Credentials (Auto-filled)</p>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Email:</span>
                    <code className="px-2 py-1 rounded bg-slate-900 text-indigo-400 font-mono text-xs">{roleConfig[selectedRole].email}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Password:</span>
                    <code className="px-2 py-1 rounded bg-slate-900 text-indigo-400 font-mono text-xs">password</code>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMFAVerify} className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Two-Factor Authentication</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Enter the OTP sent to your email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp" className="text-slate-300">
                  OTP Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="text-center text-3xl tracking-[0.5em] bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 h-14 focus:border-indigo-500 focus:ring-indigo-500/20"
                  maxLength={6}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-lg shadow-indigo-500/20"
              >
                {isLoading ? (
                  <>
                    <Spinner className="w-5 h-5 mr-2" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRequireMFA(false);
                  setOtp('');
                }}
                className="w-full text-slate-400 hover:text-white"
              >
                Back to Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
