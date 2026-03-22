import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type RankingEntry = {
  user_id: string;
  nome: string;
  total_respondidas: number;
  total_corretas: number;
  taxa_acertos: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingCard() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_top10_ranking");
      if (!error && data) {
        setRanking(data as RankingEntry[]);
      }
      setLoading(false);
    };
    fetchRanking();
  }, []);

  const getInitials = (nome: string) => {
    const parts = nome.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h2 className="font-semibold">Top 10 Guerreiros</h2>
        <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-primary/15 text-primary flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5" /> Novo
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum guerreiro no ranking ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Responda 10+ questões e opte por participar!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {ranking.map((entry, i) => {
            const isCurrentUser = entry.user_id === user?.id;
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  isCurrentUser
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-secondary/50 hover:bg-secondary"
                }`}
              >
                <span className="w-7 text-center font-bold text-sm shrink-0">
                  {i < 3 ? MEDALS[i] : `${i + 1}º`}
                </span>
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
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
                    {entry.total_respondidas} questões
                  </p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${
                  entry.taxa_acertos >= 70 ? "text-success" : entry.taxa_acertos >= 50 ? "text-warning" : "text-destructive"
                }`}>
                  {entry.taxa_acertos}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
