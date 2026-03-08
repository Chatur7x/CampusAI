import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { motion, AnimatePresence } from "framer-motion";

// LoginPage is eagerly loaded — it's the first page every user sees, no point lazy-loading it
import LoginPage from "@/pages/LoginPage";

// Everything else is lazy-loaded (only fetched when navigated to)
const ResetPasswordPage = React.lazy(() => import("@/pages/ResetPasswordPage"));
const CommandPalette = React.lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));

const AdminDashboard = React.lazy(() => import("@/dashboards/AdminDashboard"));
const FacultyDashboard = React.lazy(() => import("@/dashboards/FacultyDashboard"));
const StudentDashboard = React.lazy(() => import("@/dashboards/StudentDashboard"));

function Loading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.05),transparent_40%)] bg-slate-950 flex items-center justify-center overflow-hidden relative">
      <div className="absolute inset-0 royal-grid opacity-30 pointer-events-none" />
      <div className="flex flex-col items-center gap-8 relative z-10">
        {/* Logo or Icon */}
        <div className="relative group">
          <div className="absolute inset-[-20px] bg-emerald-500/20 blur-[40px] rounded-full animate-pulse-slow" />
          <svg className="h-20 w-20 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-bounce-slow" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="rgba(16, 185, 129, 0.05)" />
            <path d="M20 34c4-8 20-8 24 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="28" r="4" fill="currentColor" />
          </svg>
          <div className="absolute inset-0 h-20 w-20 rounded-full border-2 border-transparent border-t-emerald-400/60 animate-spin-slow" />
        </div>
        <div className="flex flex-col items-center space-y-1">
          <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter drop-shadow-sm">CampusAI</span>
          <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-slate-500/80">Smart Attendance Platform</span>
        </div>
        
        <div className="flex items-center gap-1.5 h-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-emerald-500/40"
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow { animation: bounce-slow 2s infinite cubic-bezier(.45, 0, .55, 1); }
        @keyframes spin-slow { 100% { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        .animate-pulse-slow { animation: pulse-slow 4s infinite ease-in-out; }
      `}</style>
    </div>
  );
}

/** Resolve dashboard path from user role */
function dashboardPath(role?: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin';
    case 'FACULTY':
    case 'CLASS_INCHARGE':
      return '/faculty';
    default:
      return '/student';
  }
}

/**
 * Auth callback page — Supabase PKCE / OAuth redirect lands here.
 * The URL hash/query contains the auth tokens; the onAuthStateChange
 * listener in SupabaseAuthContext picks them up automatically.
 * We just wait for the session to appear and redirect.
 */
function AuthCallback() {
  const { isAuthenticated, isLoading, user } = useSupabaseAuth();
  if (isLoading) return <Loading />;
  if (isAuthenticated) return <Navigate to={dashboardPath(user?.role)} replace />;
  // If not authenticated after processing, go back to login
  return <Navigate to="/login" replace />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  
  // While checking auth, show a minimal fast-rendering spinner (not the full Loading page)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-slate-800 border-t-emerald-500 animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useSupabaseAuth();
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {isAuthenticated ? (
                <Navigate to={dashboardPath(user?.role)} replace />
              ) : (
                <LoginPage />
              )}
            </motion.div>
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route 
          path="/auth/reset-password" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Suspense fallback={<Loading />}><ResetPasswordPage /></Suspense>
            </motion.div>
          } 
        />
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <>
                  <Suspense fallback={null}><CommandPalette /></Suspense>
                  <AdminDashboard />
                </>
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/faculty/*" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <>
                  <Suspense fallback={null}><CommandPalette /></Suspense>
                  <FacultyDashboard />
                </>
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/student/*" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <>
                  <Suspense fallback={null}><CommandPalette /></Suspense>
                  <StudentDashboard />
                </>
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SupabaseAuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </SupabaseAuthProvider>
    </ThemeProvider>
  );
}

export default App;