import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { Radar } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, supabaseUser } = useSupabaseAuth();

  useEffect(() => {
    if (session) {
      const userRole = (supabaseUser?.user_metadata as any)?.role || 'student';
      const dashboardPath =
        userRole === "SUPER_ADMIN" || userRole === "ADMIN"
          ? "/admin"
          : userRole === "FACULTY" || userRole === "CLASS_INCHARGE"
          ? "/faculty"
          : "/student";
      navigate(dashboardPath, { replace: true });
    }
  }, [session, navigate, supabaseUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md mx-auto">
        <div className="relative rounded-3xl border border-amber-300/25 bg-slate-900/85 backdrop-blur-2xl p-8 shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/6 via-transparent to-white/12 pointer-events-none" />
          <div className="absolute -inset-1 rounded-3xl border border-emerald-400/10 blur-md" />
          <div className="absolute -inset-1 rounded-3xl border border-amber-300/15 blur-lg" />

          <div className="relative space-y-6">
            <div className="space-y-2 text-center">
              <div className="flex items-center justify-center gap-2">
                <Radar className="w-6 h-6 text-emerald-300" />
                <h2 className="text-2xl font-semibold text-white">CampusAI Login</h2>
              </div>
              <p className="text-sm text-slate-400">
                Sign in to access your dashboard
              </p>
            </div>
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              theme="dark"
              providers={["google", "github"]}
              redirectTo={`${window.location.origin}/auth/callback`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}