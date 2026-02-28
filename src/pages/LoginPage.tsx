import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Activity, Loader, Radar } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [detectedRole, setDetectedRole] = useState<string>("Awaiting input");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [allowMotion, setAllowMotion] = useState(true);
  const prefersReducedMotion = useRef(false);
  const debounceTimer = useRef<number | undefined>(undefined);

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
      setError("Please fill in both email and password.");
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

  const tiltStyle = useMemo(
    () => ({
      transform: allowMotion ? `perspective(1300px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)` : "none",
      transition: prefersReducedMotion.current ? "transform 320ms ease-out" : "transform 180ms ease-out",
    }),
    [tilt, allowMotion]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mqPointer = window.matchMedia("(pointer: fine)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedMotion.current = mqMotion.matches;
      setAllowMotion(mqPointer.matches && !mqMotion.matches);
    };
    update();
    mqPointer.addEventListener("change", update);
    mqMotion.addEventListener("change", update);
    return () => {
      mqPointer.removeEventListener("change", update);
      mqMotion.removeEventListener("change", update);
    };
  }, []);

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
    <div
      className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10 relative overflow-hidden"
      onMouseMove={(e) => {
        if (!allowMotion) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;
        const x = (relX - 0.5) * 10;
        const y = (relY - 0.5) * -10;
        setTilt({ x, y });
        setCursorPos({ x: relX * 100, y: relY * 100 });
      }}
      onMouseLeave={() => {
        setTilt({ x: 0, y: 0 });
        setCursorPos({ x: 50, y: 50 });
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_70%_10%,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(99,102,241,0.12),transparent_30%)]" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0, transparent 35%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.08) 0, transparent 40%)" }} />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(115deg, rgba(255,255,255,0.12) 8%, transparent 8%), linear-gradient(245deg, rgba(255,255,255,0.08) 10%, transparent 10%)", backgroundSize: "120px 120px" }} />
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 15% 80%, rgba(251,191,36,0.1) 0, transparent 35%), radial-gradient(circle at 85% 20%, rgba(248,113,113,0.08) 0, transparent 35%)" }} />
      <div className="pointer-events-none absolute inset-0 animate-pulse" style={{ backgroundImage: "radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.04) 0, transparent 45%), radial-gradient(ellipse at 50% 80%, rgba(34,197,94,0.04) 0, transparent 40%)" }} />
      <div
        className="pointer-events-none absolute h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/15 blur-3xl transition-transform duration-200 ease-out"
        style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
      />

      <div className="grid w-full max-w-6xl grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 items-stretch">
        {/* Left: 3D animated hero */}
        <div
          className="relative overflow-hidden rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-950 p-8 shadow-[0_25px_90px_rgba(0,0,0,0.52)] transform-gpu"
          style={tiltStyle}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.18),transparent_30%),linear-gradient(120deg,rgba(255,255,255,0.05),transparent_20%)]" />
          <div className="absolute inset-8 rounded-2xl border border-white/5 pointer-events-none" />
          <div
            className="pointer-events-none absolute h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/15 blur-3xl transition-transform duration-200 ease-out"
            style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
          />

          <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-emerald-400/15 blur-3xl animate-pulse" />
          <div className="absolute right-4 bottom-6 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />

          <div className="absolute inset-0">
            <div className="absolute left-10 top-12 h-28 w-28 rounded-full border border-emerald-400/40 animate-ping" />
            <div className="absolute right-10 bottom-10 h-24 w-24 rounded-full border border-cyan-400/40 animate-ping" />
            <div className="absolute left-1/2 top-6 h-28 w-28 -translate-x-1/2 rounded-full border border-amber-300/40 animate-spin" />
            <div className="absolute left-1/2 top-6 h-36 w-36 -translate-x-1/2 rounded-full border border-amber-500/10 animate-pulse" />
            <div className="absolute left-1/2 bottom-10 h-14 w-14 -translate-x-1/2 rounded-full bg-emerald-400/30 blur-xl animate-bounce" />
            <div className="absolute left-1/4 bottom-6 h-10 w-10 rounded-full bg-cyan-400/25 blur-lg animate-pulse" />
            <div className="absolute right-1/4 top-10 h-12 w-12 rounded-full bg-amber-300/20 blur-lg animate-pulse" />
          </div>

          <div className="relative flex h-full flex-col justify-center">
            <div className="relative mt-auto h-64">
              <div className="absolute inset-0 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-lg shadow-[0_25px_80px_rgba(16,185,129,0.25)]" style={tiltStyle}>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/12 via-slate-900/50 to-cyan-500/12" />
                <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(74,222,128,0.22) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.22) 0, transparent 40%)" }} />
                <div className="relative h-full w-full overflow-hidden">
                  <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(120deg, rgba(255,255,255,0.08) 10%, transparent 10%), linear-gradient(300deg, rgba(255,255,255,0.06) 12%, transparent 12%)", backgroundSize: "90px 90px" }} />
                  <div className="absolute inset-6 rounded-2xl border border-white/15 bg-slate-950/60" />
                  <div className="absolute inset-10 grid grid-cols-3 gap-2 text-[11px] text-slate-200">
                    {["Admin", "Faculty", "Student"].map((role) => (
                      <div key={role} className="group rounded-lg border border-amber-300/20 bg-white/8 px-3 py-2 flex items-center justify-between backdrop-blur-sm shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                        <span className="group-hover:text-amber-200 transition">{role}</span>
                        <span className="h-2 w-2 rounded-full bg-amber-300 animate-ping" />
                      </div>
                    ))}
                  </div>
                  <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/30 blur-md" />
                  <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/20 blur-lg" />
                  <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300/15 blur-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div
          className="relative rounded-3xl border border-amber-300/25 bg-slate-900/85 backdrop-blur-2xl p-8 shadow-[0_28px_90px_rgba(0,0,0,0.6)] transform-gpu"
          style={tiltStyle}
        >
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/6 via-transparent to-white/12 pointer-events-none" />
          <div className="absolute -inset-1 rounded-3xl border border-emerald-400/10 blur-md" />
          <div className="absolute -inset-1 rounded-3xl border border-amber-300/15 blur-lg" />

          <div className="relative space-y-6">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Welcome back</p>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-white">Sign in</h2>
                <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs text-slate-300">
                  <Radar className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-slate-300">Detected:</span>
                  <span className="text-emerald-300 font-semibold">{detectedRole}</span>
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
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmail(val);
                      window.clearTimeout(debounceTimer.current);
                      debounceTimer.current = window.setTimeout(() => {
                        setDetectedRole(detectRoleFromEmail(val));
                      }, 120);
                      setTouched((prev) => ({ ...prev, email: true }));
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                    placeholder="you@university.edu"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20"
                    required
                    aria-invalid={touched.email && !email}
                    aria-describedby="email-error"
                  />
                  {touched.email && !email ? (
                    <p id="email-error" className="mt-1 text-xs text-red-300" aria-live="polite">Email is required.</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-200">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setTouched((prev) => ({ ...prev, password: true }));
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20"
                    required
                    aria-invalid={touched.password && !password}
                    aria-describedby="password-error"
                  />
                  {touched.password && !password ? (
                    <p id="password-error" className="mt-1 text-xs text-red-300" aria-live="polite">Password is required.</p>
                  ) : null}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition" />
                <div className="relative flex items-center justify-center gap-2">
                  {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  {isLoading ? "Signing in..." : "Enter Campus"}
                </div>
              </button>
            </form>

            <div className="pt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-3">
                <p className="font-semibold text-white text-sm mb-1">Real-time role map</p>
                <p>Role badge updates instantly while you type your email.</p>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-3">
                <p className="font-semibold text-white text-sm mb-1">Secure routing</p>
                <p>Redirects automatically to Admin, Faculty, or Student dashboards.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}