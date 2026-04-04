import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trophy, User, Shield, Pencil, Lock, Phone, Loader2, Eye, EyeOff, CreditCard, CalendarDays, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Configuracoes = () => {
  const { user, profile, subscribed, subscriptionEnd, checkSubscription } = useAuth();
  const [showInRanking, setShowInRanking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Personal data
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("show_in_ranking, nome, telefone" as any)
        .eq("user_id", user.id)
        .single();
      if (data) {
        setShowInRanking((data as any).show_in_ranking);
        setNome((data as any).nome || "");
        setTelefone((data as any).telefone || "");
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleToggleRanking = async (checked: boolean) => {
    if (!user) return;
    setSaving(true);
    setShowInRanking(checked);
    const { error } = await supabase
      .from("profiles")
      .update({ show_in_ranking: checked })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      setShowInRanking(!checked);
      toast.error("Erro ao salvar preferência");
    } else {
      toast.success(checked ? "Você agora aparece no ranking!" : "Você foi removido do ranking.");
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !nome.trim()) {
      toast.error("Nome não pode ficar vazio");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim(), telefone: telefone.trim() || null } as any)
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) {
      toast.error("Erro ao salvar dados");
    } else {
      toast.success("Dados atualizados com sucesso!");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <BackButton />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient-primary">Configurações</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas preferências de conta</p>
        </motion.div>

        {/* Profile info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Pencil className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Dados Pessoais</h2>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="nome" className="text-xs text-muted-foreground">Nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="telefone" className="text-xs text-muted-foreground">Telefone para contato</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">CPF</Label>
              <Input
                value={profile?.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") || "---"}
                disabled
                className="opacity-60"
              />
              <p className="text-[10px] text-muted-foreground mt-1">O CPF não pode ser alterado</p>
            </div>

            <Button onClick={handleSaveProfile} disabled={savingProfile || loading} size="sm">
              {savingProfile ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Salvar dados
            </Button>
          </div>
        </motion.div>

        {/* Password change */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Alterar Senha</h2>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-password" className="text-xs text-muted-foreground">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={savingPassword || !newPassword} size="sm">
              {savingPassword ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Alterar senha
            </Button>
          </div>
        </motion.div>

        {/* Ranking preference */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-gold" />
            <h2 className="font-bold text-foreground">Ranking Público</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ao ativar, seu nome aparecerá no ranking <strong>Top 10 Guerreiros</strong> do Dashboard,
            visível para todos os usuários da plataforma.
          </p>
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <Label htmlFor="ranking-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                Exibir meu nome no Ranking
              </Label>
            </div>
            <Switch
              id="ranking-toggle"
              checked={showInRanking}
              onCheckedChange={handleToggleRanking}
              disabled={loading || saving}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {showInRanking
              ? "✅ Você está participando do ranking público."
              : "🔒 Você está anônimo — seu nome não aparece no ranking."}
          </p>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
