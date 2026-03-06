import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";

/* ================================================================
   CampusAI — 3D Animated Login
   Clean, minimal, immersive
   ================================================================ */

/* ── Floating 3D shapes (pure CSS, zero deps) ── */
const shapes = [
  { size: 60, x: 12, y: 18, delay: 0, dur: 18, color: "rgba(99,102,241,0.12)", type: "cube" },
  { size: 40, x: 78, y: 25, delay: 2, dur: 22, color: "rgba(16,185,129,0.10)", type: "sphere" },
  { size: 50, x: 25, y: 70, delay: 4, dur: 20, color: "rgba(139,92,246,0.10)", type: "cube" },
  { size: 35, x: 85, y: 75, delay: 1, dur: 16, color: "rgba(59,130,246,0.12)", type: "sphere" },
  { size: 45, x: 55, y: 10, delay: 3, dur: 24, color: "rgba(236,72,153,0.08)", type: "cube" },
  { size: 30, x: 8, y: 85, delay: 5, dur: 19, color: "rgba(16,185,129,0.08)", type: "sphere" },
];

function FloatingShapes() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {shapes.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.x}%`,
            top: `${s.y}%`,
            animation: `float3d ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          <div
            className="w-full h-full"
            style={{
              background: s.color,
              borderRadius: s.type === "sphere" ? "50%" : "16%",
              border: `1px solid ${s.color}`,
              backdropFilter: "blur(2px)",
              animation: `spin3d ${s.dur * 1.5}s linear ${s.delay}s infinite`,
              transformStyle: "preserve-3d",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Animated orb behind card ── */
function GlowOrbs() {
  return (
    <div className="pointer-events-none absolute -inset-20 overflow-hidden rounded-3xl" aria-hidden>
      <div
        className="absolute w-72 h-72 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)",
          top: "-20%",
          left: "-15%",
          animation: "orbFloat 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-60 h-60 rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)",
          bottom: "-15%",
          right: "-10%",
          animation: "orbFloat 10s ease-in-out 2s infinite reverse",
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  const { isAuthenticated, user, signIn, signInWithOAuth } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── 3D tilt on mouse move ── */
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale3d(1.02,1.02,1.02)`;
    };

    const handleLeave = () => {
      card.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)";
    };

    card.addEventListener("mousemove", handleMove);
    card.addEventListener("mouseleave", handleLeave);
    return () => {
      card.removeEventListener("mousemove", handleMove);
      card.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  /* Redirect if authenticated */
  if (isAuthenticated && user) {
    const r = user.role;
    const target =
      r === "SUPER_ADMIN" || r === "ADMIN"
        ? "/admin"
        : r === "FACULTY" || r === "CLASS_INCHARGE"
          ? "/faculty"
          : "/student";
    return <Navigate to={target} replace />;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Enter email and password");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const timeout = new Promise<{ success: false; error: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, error: "Request timed out — check your connection." }), 8000)
      );
      const result = await Promise.race([signIn(email, password), timeout]);
      if (!result.success) setError(result.error || "Login failed");
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Cannot reach server. Check your internet connection.");
      } else {
        setError(msg || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center p-4 overflow-hidden">
      {/* Inject keyframe animations */}
      <style>{`
        @keyframes float3d {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-8px) translateX(-8px); }
          75% { transform: translateY(-25px) translateX(5px); }
        }
        @keyframes spin3d {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <FloatingShapes />

      {/* Grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Card container */}
      <div
        className="relative w-full max-w-[400px]"
        style={{
          animation: mounted ? "slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
          opacity: mounted ? 1 : 0,
        }}
      >
        <GlowOrbs />

        <div
          ref={cardRef}
          className="relative rounded-3xl border border-white/[0.08] p-8 shadow-2xl transition-transform duration-200 ease-out"
          style={{
            background: "linear-gradient(135deg, rgba(15,15,35,0.9) 0%, rgba(10,10,25,0.95) 100%)",
            backdropFilter: "blur(40px)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Logo with pulse */}
          <div className="flex justify-center mb-8">
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #6366f1, #10b981)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 4s ease infinite, pulseRing 3s ease-in-out infinite",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1
            className="text-center text-2xl font-bold mb-1 bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #e0e7ff, #ffffff, #a5f3fc)",
            }}
          >
            CampusAI
          </h1>
          <p className="text-center text-white/30 text-sm mb-8">Sign in to continue</p>

          {/* Form */}
          <div className="space-y-4">
            {/* Email */}
            <div className="group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onKey}
                autoFocus
                className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.07] transition-all duration-300"
                placeholder="Email"
              />
            </div>

            {/* Password */}
            <div className="group relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKey}
                className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-4 py-3 pr-11 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.07] transition-all duration-300"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/15 rounded-xl px-4 py-2.5">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}

            {/* Sign In */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="relative w-full rounded-xl py-3 text-sm font-semibold text-white overflow-hidden transition-all duration-300 disabled:opacity-50 group"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6, #10b981)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 4s ease infinite",
              }}
            >
              <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              <span className="relative flex items-center justify-center gap-2">
                {loading && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Sign In
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[11px] text-white/20 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/* OAuth */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => signInWithOAuth("google")}
                disabled={loading}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 text-sm text-white/70 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button
                onClick={() => signInWithOAuth("github")}
                disabled={loading}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 text-sm text-white/70 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
