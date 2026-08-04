import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useCurso } from "@/contexts/CursoContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Users, HelpCircle, BarChart3, Zap, ShieldCheck, Flag, Bell, Wifi, BookOpen, CreditCard, Brain, Youtube, Wrench, FileText, Lock, CalendarClock } from "lucide-react";
import { lazy, Suspense, useState } from "react";

// Lazy load das abas — reduz bundle inicial e evita cálculo simultâneo
const AdminStatsTab = lazy(() => import("@/components/admin/AdminStatsTab").then(m => ({ default: m.AdminStatsTab })));
const AdminUsersTab = lazy(() => import("@/components/admin/AdminUsersTab").then(m => ({ default: m.AdminUsersTab })));
const AdminQuestoesTab = lazy(() => import("@/components/admin/AdminQuestoesTab").then(m => ({ default: m.AdminQuestoesTab })));
const AdminReportsTab = lazy(() => import("@/components/admin/AdminReportsTab").then(m => ({ default: m.AdminReportsTab })));
const AdminNotificacoesTab = lazy(() => import("@/components/admin/AdminNotificacoesTab").then(m => ({ default: m.AdminNotificacoesTab })));
const AdminGerarTab = lazy(() => import("@/components/admin/AdminGerarTab").then(m => ({ default: m.AdminGerarTab })));
const AdminSimuladoSemanalTab = lazy(() => import("@/components/admin/AdminSimuladoSemanalTab").then(m => ({ default: m.AdminSimuladoSemanalTab })));

const AdminAuditoriaTab = lazy(() => import("@/components/admin/AdminAuditoriaTab").then(m => ({ default: m.AdminAuditoriaTab })));
const AdminPendingPatchesTab = lazy(() => import("@/components/admin/AdminPendingPatchesTab").then(m => ({ default: m.AdminPendingPatchesTab })));
const AdminOnlineTab = lazy(() => import("@/components/admin/AdminOnlineTab").then(m => ({ default: m.AdminOnlineTab })));
const AdminTextosLegaisContent = lazy(() => import("@/components/admin/AdminTextosLegaisTab"));
const AdminAssinaturasTab = lazy(() => import("@/components/admin/AdminAssinaturasTab").then(m => ({ default: m.AdminAssinaturasTab })));
const AdminMapasMentaisTab = lazy(() => import("@/components/admin/AdminMapasMentaisTab").then(m => ({ default: m.AdminMapasMentaisTab })));
const AdminBizuAulaTab = lazy(() => import("@/components/admin/AdminBizuAulaTab").then(m => ({ default: m.AdminBizuAulaTab })));
const AdminEditalTab = lazy(() => import("@/components/admin/AdminEditalTab"));
const AdminCbmtoEditorialTab = lazy(() => import("@/components/admin/AdminCbmtoEditorialTab").then(m => ({ default: m.AdminCbmtoEditorialTab })));
const AdminPopAccessTab = lazy(() => import("@/components/admin/AdminPopAccessTab").then(m => ({ default: m.AdminPopAccessTab })));

const Fallback = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const AdminPanel = () => {
  const { isAdmin, loading } = useAuth();
  const { cursoSlug } = useCurso();
  const isPmto = (cursoSlug || "pmto").toLowerCase() === "pmto";
  const isCbmto = (cursoSlug || "").toLowerCase() === "cbmto";
  const [activeTab, setActiveTab] = useState("stats");
  // Mantém abas já visitadas montadas (preserva estado entre trocas)
  const [visited, setVisited] = useState<Set<string>>(new Set(["stats"]));

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleChange = (v: string) => {
    setActiveTab(v);
    setVisited(prev => prev.has(v) ? prev : new Set(prev).add(v));
  };

  const renderTab = (key: string, Comp: React.ComponentType) =>
    visited.has(key) ? (
      <Suspense fallback={<Fallback />}>
        <Comp />
      </Suspense>
    ) : null;

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-gradient-primary">Painel Administrativo</h1>
        </div>

        <Tabs value={(!isPmto && activeTab === "pop") || (!isCbmto && activeTab === "cbmto-editorial") ? "stats" : activeTab} onValueChange={handleChange}>
          <div className="overflow-x-auto overflow-y-hidden -mx-3 sm:mx-0 px-3 sm:px-0 pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            <TabsList className="flex w-max flex-nowrap gap-1 h-auto">
              <TabsTrigger value="stats" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><BarChart3 className="w-3.5 h-3.5" />Estatísticas</TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Users className="w-3.5 h-3.5" />Usuários</TabsTrigger>
              <TabsTrigger value="questoes" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><HelpCircle className="w-3.5 h-3.5" />Questões</TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Flag className="w-3.5 h-3.5" />Relatórios</TabsTrigger>
              <TabsTrigger value="notificacoes" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Bell className="w-3.5 h-3.5" />Notificações</TabsTrigger>
              <TabsTrigger value="gerar" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Zap className="w-3.5 h-3.5" />Gerar</TabsTrigger>
              <TabsTrigger value="simulado-semanal" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><CalendarClock className="w-3.5 h-3.5" />Simulado Semanal</TabsTrigger>
              <TabsTrigger value="auditoria" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><ShieldCheck className="w-3.5 h-3.5" />Validação IA</TabsTrigger>
              <TabsTrigger value="patches" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Wrench className="w-3.5 h-3.5" />Patches pendentes</TabsTrigger>
              <TabsTrigger value="online" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Wifi className="w-3.5 h-3.5" />Online</TabsTrigger>
              <TabsTrigger value="textos" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><BookOpen className="w-3.5 h-3.5" />Textos Legais</TabsTrigger>
              <TabsTrigger value="assinaturas" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><CreditCard className="w-3.5 h-3.5" />Assinaturas</TabsTrigger>
              <TabsTrigger value="mapas" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Brain className="w-3.5 h-3.5" />Mapas Mentais</TabsTrigger>
              <TabsTrigger value="bizuaula" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Youtube className="w-3.5 h-3.5" />BizuAula</TabsTrigger>
              <TabsTrigger value="edital" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><FileText className="w-3.5 h-3.5" />Edital</TabsTrigger>
              {isCbmto && <TabsTrigger value="cbmto-editorial" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><ShieldCheck className="w-3.5 h-3.5" />Gerador/Auditor CBMTO</TabsTrigger>}
              {isPmto && <TabsTrigger value="pop" className="flex items-center gap-1.5 text-xs whitespace-nowrap"><Lock className="w-3.5 h-3.5" />POP (Sigiloso)</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="stats" className="mt-6" forceMount={visited.has("stats") ? true : undefined} hidden={activeTab !== "stats"}>{renderTab("stats", AdminStatsTab)}</TabsContent>
          <TabsContent value="users" className="mt-6" forceMount={visited.has("users") ? true : undefined} hidden={activeTab !== "users"}>{renderTab("users", AdminUsersTab)}</TabsContent>
          <TabsContent value="questoes" className="mt-6" forceMount={visited.has("questoes") ? true : undefined} hidden={activeTab !== "questoes"}>{renderTab("questoes", AdminQuestoesTab)}</TabsContent>
          <TabsContent value="reports" className="mt-6" forceMount={visited.has("reports") ? true : undefined} hidden={activeTab !== "reports"}>{renderTab("reports", AdminReportsTab)}</TabsContent>
          <TabsContent value="notificacoes" className="mt-6" forceMount={visited.has("notificacoes") ? true : undefined} hidden={activeTab !== "notificacoes"}>{renderTab("notificacoes", AdminNotificacoesTab)}</TabsContent>
          <TabsContent value="gerar" className="mt-6" forceMount={visited.has("gerar") ? true : undefined} hidden={activeTab !== "gerar"}>{renderTab("gerar", AdminGerarTab)}</TabsContent>
          <TabsContent value="simulado-semanal" className="mt-6" forceMount={visited.has("simulado-semanal") ? true : undefined} hidden={activeTab !== "simulado-semanal"}>{renderTab("simulado-semanal", AdminSimuladoSemanalTab)}</TabsContent>
          
          <TabsContent value="auditoria" className="mt-6" forceMount={visited.has("auditoria") ? true : undefined} hidden={activeTab !== "auditoria"}>{renderTab("auditoria", AdminAuditoriaTab)}</TabsContent>
          <TabsContent value="patches" className="mt-6" forceMount={visited.has("patches") ? true : undefined} hidden={activeTab !== "patches"}>{renderTab("patches", AdminPendingPatchesTab)}</TabsContent>
          <TabsContent value="online" className="mt-6" forceMount={visited.has("online") ? true : undefined} hidden={activeTab !== "online"}>{renderTab("online", AdminOnlineTab)}</TabsContent>
          <TabsContent value="textos" className="mt-6" forceMount={visited.has("textos") ? true : undefined} hidden={activeTab !== "textos"}>{renderTab("textos", AdminTextosLegaisContent)}</TabsContent>
          <TabsContent value="assinaturas" className="mt-6" forceMount={visited.has("assinaturas") ? true : undefined} hidden={activeTab !== "assinaturas"}>{renderTab("assinaturas", AdminAssinaturasTab)}</TabsContent>
          <TabsContent value="mapas" className="mt-6" forceMount={visited.has("mapas") ? true : undefined} hidden={activeTab !== "mapas"}>{renderTab("mapas", AdminMapasMentaisTab)}</TabsContent>
          <TabsContent value="bizuaula" className="mt-6" forceMount={visited.has("bizuaula") ? true : undefined} hidden={activeTab !== "bizuaula"}>{renderTab("bizuaula", AdminBizuAulaTab)}</TabsContent>
          <TabsContent value="edital" className="mt-6" forceMount={visited.has("edital") ? true : undefined} hidden={activeTab !== "edital"}>{renderTab("edital", AdminEditalTab)}</TabsContent>
          {isCbmto && <TabsContent value="cbmto-editorial" className="mt-6" forceMount={visited.has("cbmto-editorial") ? true : undefined} hidden={activeTab !== "cbmto-editorial"}>{renderTab("cbmto-editorial", AdminCbmtoEditorialTab)}</TabsContent>}
          {isPmto && <TabsContent value="pop" className="mt-6" forceMount={visited.has("pop") ? true : undefined} hidden={activeTab !== "pop"}>{renderTab("pop", AdminPopAccessTab)}</TabsContent>}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminPanel;
