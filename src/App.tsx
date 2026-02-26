import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';

// Pages
import LoginPage from '@/pages/LoginPage';
import AdminDashboard from '@/dashboards/AdminDashboard';
import FacultyDashboard from '@/dashboards/FacultyDashboard';
import StudentDashboard from '@/dashboards/StudentDashboard';

// Components
import { Spinner } from '@/components/ui/spinner';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Spinner className="w-8 h-8 text-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role || '')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function DashboardRouter() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'FACULTY':
    case 'CLASS_INCHARGE':
      return <Navigate to="/faculty" replace />;
    case 'STUDENT':
      return <Navigate to="/student" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/*"
            element={
              <ProtectedRoute allowedRoles={['FACULTY', 'CLASS_INCHARGE']}>
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/*"
            element={
              <ProtectedRoute allowedRoles={['STUDENT']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<DashboardRouter />} />
        </Routes>
      </Router>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;