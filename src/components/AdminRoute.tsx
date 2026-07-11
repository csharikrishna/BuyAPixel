import { Navigate, Outlet } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  if (authLoading || adminLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Verifying access...</p>
      </div>
    );
  }

  // Block non-authenticated users — redirect to sign in
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // Block non-admin users — redirect to home
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Admin verified — render children or outlet
  return children ? <>{children}</> : <Outlet />;
};
