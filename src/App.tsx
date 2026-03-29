import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StudyTimerProvider } from "@/components/StudyTimerProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Dashboard from "./pages/Dashboard";
import Edital from "./pages/Edital";
import Questoes from "./pages/Questoes";
import Simulados from "./pages/Simulados";
import Assinatura from "./pages/Assinatura";
import GerarQuestoes from "./pages/GerarQuestoes";
import ValidarQuestoes from "./pages/ValidarQuestoes";
import AdminPanel from "./pages/AdminPanel";
import AdminTextosLegais from "./pages/AdminTextosLegais";
import EsqueciSenha from "./pages/EsqueciSenha";
import ResetPassword from "./pages/ResetPassword";
import Contato from "./pages/Contato";
import Landing from "./pages/Landing";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StudyTimerProvider />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/assinatura" element={<Assinatura />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/edital" element={<ProtectedRoute><Edital /></ProtectedRoute>} />
            <Route path="/questoes" element={<ProtectedRoute><Questoes /></ProtectedRoute>} />
            <Route path="/simulados" element={<ProtectedRoute><Simulados /></ProtectedRoute>} />
            <Route path="/admin/gerar-questoes" element={<ProtectedRoute><GerarQuestoes /></ProtectedRoute>} />
            <Route path="/admin/validar-questoes" element={<ProtectedRoute><ValidarQuestoes /></ProtectedRoute>} />
            <Route path="/admin/textos-legais" element={<ProtectedRoute><AdminTextosLegais /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
            <Route path="/contato" element={<ProtectedRoute><Contato /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
