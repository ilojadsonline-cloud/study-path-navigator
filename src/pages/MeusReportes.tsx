import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Flag, MessageCircle, CheckCircle, Clock } from "lucide-react";

const MeusReportes = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("question_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setReports(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <BackButton />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient-primary">Meus Reportes</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe os erros que você reportou e as respostas da equipe</p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : reports.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <Flag className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Você ainda não reportou nenhuma questão.</p>
            <p className="text-xs text-muted-foreground mt-1">Ao encontrar erros, use o botão "Reportar" no Banco de Questões.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {reports.map((r: any, i: number) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="glass-card border-none">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={r.status === "resolvido" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>
                          {r.status === "resolvido" ? (
                            <><CheckCircle className="w-3 h-3 mr-1" />Resolvido</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" />Pendente</>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Questão #{r.questao_id}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Seu reporte:</p>
                      <p className="text-sm text-foreground">{r.motivo}</p>
                    </div>

                    {r.admin_notes && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          <MessageCircle className="w-3.5 h-3.5" />
                          Resposta da equipe:
                        </div>
                        <p className="text-sm text-foreground">{r.admin_notes}</p>
                        {r.resolved_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Respondido em {new Date(r.resolved_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MeusReportes;
