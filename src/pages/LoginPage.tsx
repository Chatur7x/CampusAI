import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader, Sparkles, Shield, Fingerprint, ScanFace } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [detectedRole, setDetectedRole] = useState<string>("Awaiting input");

  const detectRoleFromEmail = (value: string) => {
    const lower = value.toLowerCase();
    if (!value) return "Awaiting input";
    if (lower.includes("admin")) return "ADMIN";
    if (lower.includes("super")) return "SUPER_ADMIN";
    if (lower.includes("faculty") || lower.includes("prof") || lower.includes("teacher")) return "FACULTY";
    if (lower.includes("incharge") || lower.includes("class")) return "CLASS_INCHARGE";
    return "STUDENT";
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      const dashboardPath =
        user.role === "SUPER_ADMIN" || user.role === "ADMIN"
          ? "/admin"
          : user.role === "FACULTY" || user.role === "CLASS_INCHARGE"
          ? "/faculty"
          : "/student";
      navigate(dashboardPath, { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Email and password are required");
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(email, password);
      if (result.detectedRole) {
        setDetectedRole(result.detectedRole);
      }
      if (!result.success) {
        setError(result.message || "Login failed");
      }
    } catch (err) {
      setError("Login error. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-slate-800" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.15),transparent_35%),radial-gradient(circle_at_70%_10%,rgba(14,165,233,0.15),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(99,102,241,0.12),transparent_30%)]" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

      <div className="grid w-full max-w-6xl grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-stretch">
        {/* Left: 3D hero */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-900 via-slate-900/60 to-slate-950 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] transform-gpu">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.22),transparent_30%),linear-gradient(120deg,rgba(255,255,255,0.06),transparent_20%)]" />
          <div className="absolute inset-8 rounded-2xl border border-white/5 pointer-events-none" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-emerald-200 shadow-inner shadow-emerald-500/20">
                <Shield className="w-3.5 h-3.5" />
                Zero-click role detection
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <Sparkles className="w-4 h-4" />
                  AI-SmartAttendance
                </div>
                <h1 className="text-4xl lg:text-5xl font-semibold leading-tight text-white">Glassmorphic 3D Access</h1>
                <p className="text-sm text-slate-300 max-w-2xl">
                  Secure entry with automatic role discovery. Facial or biometric verification ready, blockchain-backed audit, and instant routing to the right portal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-emerald-300 text-sm mb-2">
                  <ScanFace className="w-4 h-4" /> AI Face / Device Biometrics
                </div>
                <p className="text-slate-200 text-sm leading-relaxed">Smart attendance, liveness checks, and instant percentage updates.</p>
              </div>
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-cyan-300 text-sm mb-2">
                  <Fingerprint className="w-4 h-4" /> Blockchain-grade security
                </div>
                <p className="text-slate-200 text-sm leading-relaxed">Immutable records, audit-ready trails, and role-aware routing.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="relative rounded-3xl border border-slate-800/70 bg-slate-900/70 backdrop-blur-xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)] transform-gpu">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/3 via-transparent to-white/2 pointer-events-none" />
          <div className="relative space-y-6">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Welcome back</p>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-white">Sign in</h2>
                <div className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs text-slate-300">
                  Auto-detected: <span className="text-emerald-300 font-semibold">{detectedRole}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleCredentialLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-200">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setDetectedRole(detectRoleFromEmail(e.target.value));
                  }}
                  placeholder="you@university.edu"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-200">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition" />
                <div className="relative flex items-center justify-center gap-2">
                  {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  {isLoading ? "Signing in..." : "Enter Campus"}
                </div>
              </button>
            </form>

            <div className="pt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-3">
                <p className="font-semibold text-white text-sm mb-1">Biometric ready</p>
                <p>Facial + fingerprint options when faculty runs Smart Attendance.</p>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-3">
                <p className="font-semibold text-white text-sm mb-1">Role-aware routing</p>
                <p>Redirects automatically to Admin, Faculty, or Student dashboards.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}