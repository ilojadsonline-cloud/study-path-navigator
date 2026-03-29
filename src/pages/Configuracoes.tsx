import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trophy, User, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Configuracoes = () => {
  const { user, profile } = useAuth();
  const [showInRanking, setShowInRanking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("show_in_ranking")
        .eq("user_id", user.id)
        .single();
      if (data) setShowInRanking(data.show_in_ranking);
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
          className="glass-card rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{profile?.nome || "Usuário"}</p>
              <p className="text-xs text-muted-foreground">
                CPF: {profile?.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4") || "---"}
              </p>
            </div>
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
            visível para todos os usuários da plataforma. Você pode alterar essa opção a qualquer momento.
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
