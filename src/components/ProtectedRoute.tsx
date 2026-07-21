import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, subscribed, subscriptionLoading, trialExpired, isAdmin, signOut } = useAuth();

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Admins nunca precisam de assinatura e nunca têm acesso expirado.
  if (isAdmin) {
    return <>{children}</>;
  }

  if (trialExpired) {
    void signOut();
    return <Navigate to="/assinatura" replace />;
  }

  if (!subscribed) {
    return <Navigate to="/assinatura" replace />;
  }

  return <>{children}</>;
}
