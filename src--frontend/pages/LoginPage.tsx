import { useState, useEffect, useRef, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";

/* ================================================================
   CampusAI — iOS Glassmorphism Login
   Frosted glass, translucent cards, soft shadows, pill shapes
   ================================================================ */

/* ── Role detection from email ── */
type DetectedRole = { key: string; label: string; icon: string; color: string };

const ROLES: Record<string, DetectedRole> = {
  admin:   { key: "admin",   label: "Admin",   icon: "🛡️", color: "#6366f1" },
  faculty: { key: "faculty", label: "Faculty", icon: "👨‍🏫", color: "#10b981" },
  student: { key: "student", label: "Student", icon: "🎓", color: "#3b82f6" },
};

function detectRole(email: string): DetectedRole | null {
  const e = email.toLowerCase().trim();
  if (!e) return null;
  // Admin patterns
  if (e.startsWith("admin") || e.includes("superadmin") || e.includes("principal")) return ROLES.admin;
  // Faculty patterns — contains "faculty", starts with department keyword + @
  if (e.includes("faculty") || /^[a-z]+\.[a-z]+@/.test(e) && (e.includes("prof") || e.includes("hod"))) return ROLES.faculty;
  // Student patterns — roll number-like prefix (digits or alphanumeric enrollment IDs)
  if (/^\d{2}[a-z]{2,5}\d/.test(e)) return ROLES.student;
  // Faculty: name-like emails at edu domain (e.g. saikrishnait@anurag.edu.in)
  if (/^[a-z]{4,}(it|cs|ece|eee|mech|civil|chem)@/.test(e)) return ROLES.faculty;
  // Fallback: if has edu domain but no roll number pattern → faculty-like
  if (e.includes("@") && e.includes(".edu") && !/^\d/.test(e)) return ROLES.faculty;
  return null;
}

/* ── Blurred background blobs ── */
function GlassBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Large mesh gradient blobs */}
      <div className="absolute w-[600px] h-[600px] rounded-full opacity-50 blur-[120px]"
        style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", top: "-15%", left: "-10%", animation: "blobDrift 20s ease-in-out infinite" }} />
      <div className="absolute w-[500px] h-[500px] rounded-full opacity-40 blur-[100px]"
        style={{ background: "linear-gradient(135deg, #f093fb, #f5576c)", bottom: "-10%", right: "-5%", animation: "blobDrift 25s ease-in-out 3s infinite reverse" }} />
      <div className="absolute w-[400px] h-[400px] rounded-full opacity-35 blur-[80px]"
        style={{ background: "linear-gradient(135deg, #4facfe, #00f2fe)", top: "40%", left: "50%", transform: "translate(-50%,-50%)", animation: "blobDrift 18s ease-in-out 1s infinite" }} />
      <div className="absolute w-[300px] h-[300px] rounded-full opacity-30 blur-[90px]"
        style={{ background: "linear-gradient(135deg, #43e97b, #38f9d7)", bottom: "20%", left: "15%", animation: "blobDrift 22s ease-in-out 5s infinite reverse" }} />
    </div>
  );
}

export default function LoginPage() {
  const { isAuthenticated, user, signIn, signInWithOAuth, signOut } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const detectedRole = useMemo(() => detectRole(email), [email]);

  useEffect(() => { setMounted(true); }, []);

  /* ── Subtle 3D tilt on mouse ── */
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const handleMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
    };
    const handleLeave = () => { card.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)"; };
    card.addEventListener("mousemove", handleMove);
    card.addEventListener("mouseleave", handleLeave);
    return () => { card.removeEventListener("mousemove", handleMove); card.removeEventListener("mouseleave", handleLeave); };
  }, []);

  /* Redirect logic — Modified to show "Continue as" identity card instead of auto-redirecting if a session is found on the login page hit */
  const [skipAutoRedirect, setSkipAutoRedirect] = useState(false);

  // If already authenticated, we still show the login page BUT with a "Continue as" identity card 
  // unless we are already redirecting.
  useEffect(() => {
    if (isAuthenticated && !skipAutoRedirect) {
      // Small delay to show the transition or we could just show the card
      // For now, let's keep the user on the login page so they can see the "Switch Account" option
    }
  }, [isAuthenticated, skipAutoRedirect]);

  const handleContinueAs = () => {
    if (!user) return;
    const r = user.role;
    const target =
      r === "SUPER_ADMIN" || r === "ADMIN"
        ? "/admin"
        : r === "FACULTY" || r === "CLASS_INCHARGE"
          ? "/faculty"
          : "/student";
    window.location.href = target;
  };

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
      
      if (!result.success) {
        setError(result.error || "Login failed due to an unknown database issue. Please try again.");
      } else {
        // Fix: If login succeeded but React Router hasn't redirected yet (e.g., due to suppressed schema error fallback),
        // we force a redirect by waiting a split second, then doing a hard reload.
        setTimeout(() => {
          if (window.location.pathname === "/login") {
            window.location.reload();
          }
        }, 1000);
      }
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("🔌 Cannot reach the authentication server. Please check your internet connection or ensure the backend is running.");
      } else {
        setError(msg || "An unexpected error disrupted the login process.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1a3e 30%, #24243e 60%, #0f0c29 100%)" }}>

      {/* Animations */}
      <style>{`
        @keyframes blobDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(30px) scale(0.96); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes roleBadgeIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <GlassBlobs />

      {/* Frosted noise overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.015]" aria-hidden
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Card */}
      <div className="relative w-full max-w-[420px] z-10"
        style={{ animation: mounted ? "cardIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none", opacity: mounted ? 1 : 0 }}>

        <div ref={cardRef}
          className="relative rounded-[28px] border border-white/[0.12] p-8 transition-transform duration-200 ease-out"
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(60px) saturate(180%)",
            WebkitBackdropFilter: "blur(60px) saturate(180%)",
            boxShadow: "0 8px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.05)",
            transformStyle: "preserve-3d",
          }}>

          {/* Top glow line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Logo */}
          <div className="flex justify-center mb-7">
            <div className="relative w-[60px] h-[60px] rounded-[18px] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.8), rgba(16,185,129,0.8))",
                boxShadow: "0 8px 32px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}>
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-center text-[22px] font-semibold text-white/90 mb-0.5 tracking-tight">CampusAI</h1>
          <p className="text-center text-white/35 text-[13px] mb-7">Sign in to your account</p>

          {/* Auto-detected role badge */}
          {detectedRole && (
            <div className="flex justify-center mb-5" style={{ animation: "roleBadgeIn 0.3s ease-out forwards" }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[12px] font-medium"
                style={{
                  background: `${detectedRole.color}15`,
                  borderColor: `${detectedRole.color}30`,
                  color: `${detectedRole.color}`,
                  backdropFilter: "blur(20px)",
                  boxShadow: `0 4px 20px ${detectedRole.color}10`,
                }}>
                <span className="text-sm">{detectedRole.icon}</span>
                <span>Detected: <strong>{detectedRole.label}</strong></span>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: detectedRole.color }} />
              </div>
            </div>
          )}

          {/* Identity Switcher / Login Form */}
          {isAuthenticated && user ? (
            <div className="space-y-6 pt-2 pb-4">
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 rounded-full p-1 border-2 border-indigo-500/30 mb-4">
                  {user.profile?.avatar_url ? (
                    <img src={user.profile.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl">
                      {user.profile?.first_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-2 border-[#1a1a3e] rounded-full flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-white text-[18px] font-medium mb-1">
                  Welcome back, {user.profile?.first_name || 'User'}
                </h2>
                <p className="text-white/40 text-[13px] mb-6">{user.email}</p>
                
                <button onClick={handleContinueAs}
                  className="w-full rounded-2xl py-3.5 text-[14px] font-semibold text-white mb-4 transition-all duration-300 active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    boxShadow: "0 8px 32px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}>
                  Continue to {user.role.replace('_', ' ')} Portal
                </button>
                
                <button 
                  onClick={() => signOut()}
                  className="text-white/40 hover:text-white/70 text-[13px] font-medium transition-colors"
                >
                  Sign in with a different account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Email input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  onKeyDown={onKey}
                  autoFocus
                  className="w-full rounded-2xl py-3.5 pl-12 pr-4 text-[14px] text-white placeholder:text-white/25 focus:outline-none transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.4)"; e.target.style.background = "rgba(255,255,255,0.08)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                  placeholder="Email address"
                />
              </div>

              {/* Password input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={onKey}
                  className="w-full rounded-2xl py-3.5 pl-12 pr-12 text-[14px] text-white placeholder:text-white/25 focus:outline-none transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.4)"; e.target.style.background = "rgba(255,255,255,0.08)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                  placeholder="Password"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-200"
                  tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 text-[12px] text-rose-300 rounded-2xl px-4 py-3"
                  style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)", backdropFilter: "blur(20px)" }}>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Sign In Button */}
              <button onClick={handleLogin} disabled={loading}
                className="relative w-full rounded-2xl py-3.5 text-[14px] font-semibold text-white overflow-hidden transition-all duration-300 disabled:opacity-50 group mt-1"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6, #10b981)",
                  backgroundSize: "200% 200%",
                  animation: "gradientShift 4s ease infinite",
                  boxShadow: "0 8px 32px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}>
                <span className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.08] transition-colors duration-300" />
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
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                <span className="text-[11px] text-white/20 uppercase tracking-widest font-medium">or</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              </div>

              {/* OAuth — glassmorphism buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => signInWithOAuth("google")} disabled={loading}
                  className="rounded-2xl py-2.5 text-[13px] text-white/70 hover:text-white/90 flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </button>
                <button onClick={() => signInWithOAuth("github")} disabled={loading}
                  className="rounded-2xl py-2.5 text-[13px] text-white/70 hover:text-white/90 flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </button>
              </div>
            </div>
          )}

          {/* Bottom glow line */}
          <div className="absolute bottom-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Subtle reflection under card */}
        <div className="mx-8 h-8 rounded-b-3xl opacity-20 blur-md"
          style={{ background: "linear-gradient(to bottom, rgba(99,102,241,0.15), transparent)" }} />
      </div>
    </div>
  );
}
