import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  CalendarDays, Sparkles, Settings2, Trash2, Eye, Copy, Loader2, Clock, Plus,
} from "lucide-react";
import {
  CronogramaData, AtividadeBloco, gerarCronogramaPadrao,
} from "@/lib/cronograma-generator";
import { VisualizadorCronograma } from "@/components/cronograma/VisualizadorCronograma";
import { GeradorPersonalizado } from "@/components/cronograma/GeradorPersonalizado";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CronogramaDB {
  id: string;
  nome: string;
  tipo: string;
  horas_semanais: number;
  distribuicao: any;
  dias_semana: string[];
  horario_inicio: string;
  horario_fim: string;
  atividades: any;
  created_at: string;
  ativo: boolean;
}

type View = "list" | "view" | "custom";

export default function Cronograma() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("list");
  const [cronogramas, setCronogramas] = useState<CronogramaDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCronograma, setActiveCronograma] = useState<CronogramaData | null>(null);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchCronogramas = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cronogramas")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setCronogramas(data as unknown as CronogramaDB[]);
    setLoading(false);
  };

  useEffect(() => { fetchCronogramas(); }, [user]);

  const handleGerarPadrao = () => {
    const padrao = gerarCronogramaPadrao();
    setActiveCronograma(padrao);
    setActiveId(undefined);
    setView("view");
  };

  const handleCustomGenerate = (c: CronogramaData) => {
    setActiveCronograma(c);
    setActiveId(undefined);
    setView("view");
  };

  const handleViewExisting = (c: CronogramaDB) => {
    setActiveCronograma({
      nome: c.nome,
      tipo: c.tipo as "padrao" | "personalizado",
      horas_semanais: c.horas_semanais,
      distribuicao: c.distribuicao,
      dias_semana: c.dias_semana,
      horario_inicio: c.horario_inicio,
      horario_fim: c.horario_fim,
      atividades: c.atividades as AtividadeBloco[],
    });
    setActiveId(c.id);
    setView("view");
  };

  const handleDuplicate = async (c: CronogramaDB) => {
    if (!user) return;
    const { error } = await supabase.from("cronogramas").insert({
      user_id: user.id,
      nome: `${c.nome} (cópia)`,
      tipo: c.tipo,
      horas_semanais: c.horas_semanais,
      distribuicao: c.distribuicao,
      dias_semana: c.dias_semana,
      horario_inicio: c.horario_inicio,
      horario_fim: c.horario_fim,
      atividades: c.atividades,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Duplicado!", description: "Cronograma duplicado com sucesso." });
      fetchCronogramas();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("cronogramas").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído", description: "Cronograma excluído." });
      fetchCronogramas();
    }
    setDeleteId(null);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold">Cronograma de Estudos</h1>
        </div>

        {view === "list" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Action buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary/50" onClick={handleGerarPadrao}>
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg">Gerar Cronograma Padrão (20h)</h3>
                  <p className="text-sm text-muted-foreground">
                    Cronograma automático baseado no padrão recomendado por especialistas
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary/50" onClick={() => setView("custom")}>
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Settings2 className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg">Criar Cronograma Personalizado</h3>
                  <p className="text-sm text-muted-foreground">
                    Defina suas horas, distribuição e dias de estudo
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Saved schedules */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" /> Cronogramas Salvos
              </h2>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : cronogramas.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Você ainda não tem cronogramas. Crie um agora!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {cronogramas.map(c => (
                    <Card key={c.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 w-full">
                          <h3 className="font-semibold truncate">{c.nome}</h3>
                          <p className="text-xs text-muted-foreground">
                            {c.horas_semanais}h/semana • {c.tipo === "padrao" ? "Padrão" : "Personalizado"} • {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                          <Button variant="outline" size="sm" onClick={() => handleViewExisting(c)} className="flex-1 sm:flex-none">
                            <Eye className="w-4 h-4 mr-1" /> Ver
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDuplicate(c)} className="flex-1 sm:flex-none">
                            <Copy className="w-4 h-4 mr-1" /> Duplicar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === "view" && activeCronograma && (
          <VisualizadorCronograma
            cronograma={activeCronograma}
            existingId={activeId}
            onBack={() => { setView("list"); fetchCronogramas(); }}
            onSaved={() => { setView("list"); fetchCronogramas(); }}
          />
        )}

        {view === "custom" && (
          <GeradorPersonalizado
            onGenerate={handleCustomGenerate}
            onBack={() => setView("list")}
          />
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cronograma?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
