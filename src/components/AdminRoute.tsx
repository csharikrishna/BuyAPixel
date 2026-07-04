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

  // Let the child component (e.g. AdminDashboard) handle the actual Access Denied UI
  // so the user sees the "Access Denied" message instead of getting bounced around.
  return children ? <>{children}</> : <Outlet />;
};
