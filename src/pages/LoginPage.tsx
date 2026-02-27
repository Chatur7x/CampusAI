import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { Github, Mail, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signInWithOAuth } = useSupabaseAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

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

  const handleGitHubLogin = async () => {
    setError("");
    setIsLoading(true);

    try {
      const result = await signInWithOAuth("github");
      if (!result.success) {
        setError(result.error || "GitHub login failed");
      }
      // Supabase OAuth handles redirect automatically
    } catch (err) {
      setError("GitHub login error. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email) {
      setError("Please enter your email");
      setIsLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setError(""); // Clear error on success
        // Show success message instead
        alert("Check your email for the login link!");
        setEmail("");
      }
    } catch (err) {
      setError("Magic link error. Please try again.");
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
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(88,28,135,0.35),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.35),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(99,102,241,0.35),transparent_30%)]" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Secure AI-Powered Access
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-white">
                AI-SmartAttendance
              </h1>
              <p className="text-sm text-slate-300">
                Campus management system with AI-powered face recognition, blockchain verification, and real-time analytics.
              </p>
            </div>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded bg-emerald-400/20 flex items-center justify-center text-emerald-400 flex-shrink-0">✓</div>
                <div>Real-time attendance tracking with AI face recognition</div>
              </div>
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded bg-emerald-400/20 flex items-center justify-center text-emerald-400 flex-shrink-0">✓</div>
                <div>Blockchain-verified attendance records</div>
              </div>
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded bg-emerald-400/20 flex items-center justify-center text-emerald-400 flex-shrink-0">✓</div>
                <div>Advanced analytics and reporting</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Welcome</p>
            <h2 className="text-2xl font-semibold text-white">Sign in to your account</h2>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* GitHub OAuth */}
            <button
              onClick={handleGitHubLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Github className="w-4 h-4" />
              )}
              {isLoading ? "Connecting..." : "Continue with GitHub"}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">Or</span>
              </div>
            </div>

            {/* Magic Link Form */}
            <form onSubmit={handleMagicLinkLogin} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm text-slate-200">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {isLoading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>

            {/* Info Text */}
            <p className="text-xs text-slate-400 text-center pt-2">
              We'll send you a secure login link via email.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}