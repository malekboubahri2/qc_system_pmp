import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="PMP" className="h-16 w-auto" />
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'operator') {
    // An operator landed on an admin route — send them to the PWA.
    window.location.href = '/inspect.html';
    return null;
  }
  return <>{children}</>;
}
