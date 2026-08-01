import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCurso } from "@/contexts/CursoContext";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Loader2, Info, Shield, Medal } from "lucide-react";

type RankingEntry = {
  user_id: string;
  nome: string;
  total_respondidas: number;
  total_corretas: number;
  taxa_acertos: number;
};

type MyPosition = {
  rank: number;
  total_respondidas: number;
  total_corretas: number;
  taxa_acertos: number;
};

type Period = "week" | "month" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "all", label: "Geral" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

const taxaColor = (t: number) =>
  t >= 70 ? "text-success" : t >= 50 ? "text-warning" : "text-destructive";

const Ranking = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { cursoId, cursoAtivo, cursos } = useCurso();
  const [period, setPeriod] = useState<Period>("all");
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [myPosition, setMyPosition] = useState<MyPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInRanking, setShowInRanking] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    const [{ data: rk }, { data: mine }] = await Promise.all([
      supabase.rpc("get_ranking", { p_period: period, p_curso_id: cursoId }),
      supabase.rpc("get_my_ranking_position", { p_period: period, p_curso_id: cursoId }),
    ]);
    setRanking((rk as RankingEntry[]) || []);
    setMyPosition(mine && (mine as MyPosition[])[0] ? (mine as MyPosition[])[0] : null);
    setLoading(false);
  }, [period, cursoId]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("show_in_ranking")
        .eq("user_id", user.id)
        .maybeSingle();
      setShowInRanking(!!data?.show_in_ranking);
    })();
  }, [user]);

  const togglePrivacy = async (value: boolean) => {
    if (!user) return;
    setSavingPrivacy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ show_in_ranking: value } as never)
      .eq("user_id", user.id);
    setSavingPrivacy(false);
    if (error) {
      toast({ title: "Erro ao salvar preferência", variant: "destructive" });
      return;
    }
    setShowInRanking(value);
    toast({
      title: value ? "Você agora aparece no ranking público" : "Você está em modo privado",
      description: value
        ? "Seu nome poderá ser exibido no ranking público."
        : "Seu nome não aparece publicamente. Sua posição é visível apenas para você.",
    });
    fetchRanking();
  };

  const getInitials = (nome: string) => {
    const parts = nome.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 w-full min-w-0">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-gold" />
            <span className="text-gradient-primary">Ranking</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-xl">
            Compita com outros guerreiros e acompanhe seu desempenho. O ranking é
            calculado pela <strong>taxa de acerto</strong>, com desempate por número de
            questões respondidas. É necessário ter pelo menos 10 questões respondidas.
          </p>
        </motion.div>

        {/* Privacidade */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-4 sm:p-5 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Aparecer no ranking público</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {showInRanking
                  ? "Ativado: seu nome pode aparecer no ranking público."
                  : "Desativado: seu nome não aparece publicamente; sua posição é exibida apenas para você."}
              </p>
            </div>
          </div>
          <div className="shrink-0 pt-1">
            {savingPrivacy ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <Switch checked={showInRanking} onCheckedChange={togglePrivacy} />
            )}
          </div>
        </motion.div>

        {/* Minha posição */}
        {myPosition && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 sm:p-5 border border-primary/25 bg-primary/5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                  <Medal className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Sua posição</p>
                  <p className="text-xl font-bold">
                    {myPosition.rank}º lugar
                    {!showInRanking && (
                      <span className="text-[10px] text-muted-foreground ml-2 font-normal">
                        (visível apenas para você)
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {myPosition.total_respondidas} questões respondidas
                  </p>
                </div>
              </div>
              <span className={`text-2xl font-bold shrink-0 ${taxaColor(myPosition.taxa_acertos)}`}>
                {myPosition.taxa_acertos}%
              </span>
            </div>
          </motion.div>
        )}

        {/* Filtros de período */}
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                period === p.key
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Lista do ranking */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-4 sm:p-5"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : ranking.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum guerreiro no ranking neste período ainda.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Responda 10+ questões e ative sua participação para entrar!
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {ranking.map((entry, i) => {
                const isCurrentUser = entry.user_id === user?.id;
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isCurrentUser
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-secondary/50 hover:bg-secondary"
                    }`}
                  >
                    <span className="w-8 text-center font-bold text-sm shrink-0">
                      {i < 3 ? MEDALS[i] : `${i + 1}º`}
                    </span>
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {getInitials(entry.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.nome.split(" ")[0]}
                        {isCurrentUser && (
                          <span className="text-[10px] text-primary ml-1">(você)</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.total_respondidas} questões • {entry.total_corretas} acertos
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${taxaColor(entry.taxa_acertos)}`}>
                      {entry.taxa_acertos}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Como é calculado */}
        <div className="glass-card rounded-xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            O ranking ordena os alunos pela <strong>taxa de acerto</strong> (percentual de
            questões corretas), usando o número de questões respondidas como critério de
            desempate. Alunos que optaram por não aparecer publicamente são ocultados da
            lista, mas ainda visualizam a própria posição. Use os filtros para ver o
            desempenho da semana, do mês ou geral.
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Ranking;
