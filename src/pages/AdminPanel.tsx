import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Users, HelpCircle, BarChart3, Zap, ShieldCheck, Flag, Bell } from "lucide-react";
import { AdminStatsTab } from "@/components/admin/AdminStatsTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminQuestoesTab } from "@/components/admin/AdminQuestoesTab";
import { AdminGerarTab } from "@/components/admin/AdminGerarTab";
import { AdminValidarTab } from "@/components/admin/AdminValidarTab";
import { AdminReportsTab } from "@/components/admin/AdminReportsTab";
import { AdminNotificacoesTab } from "@/components/admin/AdminNotificacoesTab";

const AdminPanel = () => {
  const { isAdmin, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-gradient-primary">Painel Administrativo</h1>
        </div>

        <Tabs defaultValue="stats">
          <TabsList className="flex flex-wrap gap-1 h-auto max-w-2xl">
            <TabsTrigger value="stats" className="flex items-center gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" />Estatísticas</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />Usuários</TabsTrigger>
            <TabsTrigger value="questoes" className="flex items-center gap-1.5 text-xs"><HelpCircle className="w-3.5 h-3.5" />Questões</TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5 text-xs"><Flag className="w-3.5 h-3.5" />Relatórios</TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-1.5 text-xs"><Bell className="w-3.5 h-3.5" />Notificações</TabsTrigger>
            <TabsTrigger value="gerar" className="flex items-center gap-1.5 text-xs"><Zap className="w-3.5 h-3.5" />Gerar</TabsTrigger>
            <TabsTrigger value="validar" className="flex items-center gap-1.5 text-xs"><ShieldCheck className="w-3.5 h-3.5" />Validar</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-6"><AdminStatsTab /></TabsContent>
          <TabsContent value="users" className="mt-6"><AdminUsersTab /></TabsContent>
          <TabsContent value="questoes" className="mt-6"><AdminQuestoesTab /></TabsContent>
          <TabsContent value="reports" className="mt-6"><AdminReportsTab /></TabsContent>
          <TabsContent value="notificacoes" className="mt-6"><AdminNotificacoesTab /></TabsContent>
          <TabsContent value="gerar" className="mt-6"><AdminGerarTab /></TabsContent>
          <TabsContent value="validar" className="mt-6"><AdminValidarTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminPanel;
