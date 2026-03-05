import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "@/components/ui/sonner";

// Lazy load everything except the shell providers
const LoginPage = React.lazy(() => import("@/pages/LoginPage"));
const ResetPasswordPage = React.lazy(() => import("@/pages/ResetPasswordPage"));
const CommandPalette = React.lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));

const AdminDashboard = React.lazy(() => import("@/dashboards/AdminDashboard"));
const FacultyDashboard = React.lazy(() => import("@/dashboards/FacultyDashboard"));
const StudentDashboard = React.lazy(() => import("@/dashboards/StudentDashboard"));

function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-slate-800" />
          <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-500 animate-pulse">Loading...</p>
      </div>
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
  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useSupabaseAuth();

  return (
    <>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={dashboardPath(user?.role)} replace />
            ) : (
              <Suspense fallback={<Loading />}>
                <LoginPage />
              </Suspense>
            )
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/reset-password" element={<Suspense fallback={<Loading />}><ResetPasswordPage /></Suspense>} />
        <Route path="/admin/*" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/faculty/*" element={<ProtectedRoute><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/student/*" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
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