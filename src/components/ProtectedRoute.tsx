import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurso } from "@/contexts/CursoContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, subscriptionLoading, isAdmin } = useAuth();
  const { cursoAtivo, temAcesso, loading: cursoLoading } = useCurso();

  if (loading || subscriptionLoading || cursoLoading) {
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

  // Sem acesso ao curso selecionado → volta para a escolha de curso
  if (!temAcesso(cursoAtivo)) {
    return <Navigate to="/cursos" replace />;
  }

  return <>{children}</>;
}
