import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCurso } from "@/contexts/CursoContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Loader2, Search, Trash2 } from "lucide-react";

type Pair = {
  dup_id: number;
  keep_id: number;
  sim_enun: number;
  sim_alts: number;
  dup_enun: string;
  keep_enun: string;
};

export function DedupQuestoesCard() {
  const { cursoId, cursoSlug } = useCurso();
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [disciplina, setDisciplina] = useState<string>("");
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Carrega a lista de disciplinas uma vez
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_disciplinas", { p_curso_id: cursoId });
      if (error) {
        toast.error("Erro ao carregar disciplinas", { description: error.message });
        return;
      }
      const list = ((data as { disciplina: string }[]) || [])
        .map((d) => d.disciplina)
        .filter(Boolean);
      const listWithPop = cursoSlug === "pmto" && !list.includes("POP") ? [...list, "POP"] : list;
      setDisciplinas(listWithPop);
    })();
  }, [cursoId, cursoSlug]);

  const analisar = async () => {
    if (!disciplina) {
      toast.error("Escolha uma disciplina primeiro.");
      return;
    }
    setLoading(true);
    setPairs(null);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.rpc("dedup_disciplina_preview", {
        p_disciplina: disciplina,
        p_threshold_enun: 0.82,
        p_threshold_alts: 0.78,
        p_curso_id: cursoId,
      });
      if (error) throw error;
      const result = (data as Pair[]) || [];
      setPairs(result);
      // Por padrão, marca a questão "repetida" (dup_id) de cada par para exclusão
      setSelected(new Set(result.map((p) => p.dup_id)));
      toast.success(
        result.length ? `${result.length} possível(is) repetida(s) encontrada(s)` : "Nenhuma repetida encontrada",
        {
          description: result.length
            ? "Revise os pares e desmarque o que quiser manter."
            : `A disciplina "${disciplina}" não tem questões similares acima do limiar.`,
        },
      );
    } catch (err: any) {
      toast.error("Erro ao analisar", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const excluir = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error("Nenhuma questão selecionada.");
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("excluir_questoes_por_ids", { p_ids: ids });
      if (error) throw error;
      toast.success(`${data ?? ids.length} questão(ões) excluída(s)`, {
        description: "Marcadas como deletadas (reversível na aba Questões → filtro Deletadas → Restaurar).",
      });
      // Remove os pares cujas questões foram excluídas
      setPairs((prev) => (prev ? prev.filter((p) => !selected.has(p.dup_id)) : prev));
      setSelected(new Set());
    } catch (err: any) {
      toast.error("Erro ao excluir", { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const selectedCount = selected.size;
  const hasPairs = useMemo(() => (pairs?.length ?? 0) > 0, [pairs]);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="w-5 h-5 text-primary" />
          Questões repetidas por disciplina
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Escolha uma disciplina e clique em <strong>Analisar</strong>. O sistema compara as questões entre si
          e mostra os pares parecidos. As repetidas já vêm marcadas — desmarque o que quiser manter e clique em
          <strong> Excluir selecionadas</strong>. A exclusão é reversível.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[240px]">
            <label className="text-xs text-muted-foreground">Disciplina</label>
            <Select value={disciplina} onValueChange={setDisciplina}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a disciplina" />
              </SelectTrigger>
              <SelectContent>
                {disciplinas.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={analisar} disabled={loading || deleting || !disciplina} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analisar
          </Button>
        </div>

        {pairs && (
          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{pairs.length} par(es) parecido(s)</Badge>
              <Badge variant={selectedCount ? "destructive" : "outline"}>{selectedCount} selecionada(s)</Badge>

              {hasPairs && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={deleting || selectedCount === 0} variant="destructive" size="sm" className="gap-2 ml-auto">
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Excluir selecionadas ({selectedCount})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {selectedCount} questão(ões)?</AlertDialogTitle>
                      <AlertDialogDescription>
                        As questões selecionadas serão marcadas como <strong>deletadas</strong> e deixarão de
                        aparecer para os alunos. Isso é reversível: na aba Questões, filtro "Deletadas", você
                        pode restaurar qualquer uma.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {hasPairs ? (
              <ScrollArea className="h-96 rounded-lg border border-border/40 p-2">
                <div className="space-y-2">
                  {pairs.map((p) => {
                    const checked = selected.has(p.dup_id);
                    return (
                      <div
                        key={`${p.dup_id}-${p.keep_id}`}
                        className={`text-xs p-3 rounded border transition-colors ${
                          checked ? "border-destructive/50 bg-destructive/5" : "border-border/40 bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2 text-[11px] text-muted-foreground">
                          <span>Similaridade: enunciado {(p.sim_enun * 100).toFixed(0)}% · alternativas {(p.sim_alts * 100).toFixed(0)}%</span>
                        </div>

                        {/* Questão candidata a remover */}
                        <label className="flex items-start gap-2 cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={() => toggle(p.dup_id)} className="mt-0.5" />
                          <span>
                            <span className="text-destructive font-medium">Excluir #{p.dup_id}:</span>{" "}
                            <span className="text-foreground/90">{p.dup_enun}</span>
                          </span>
                        </label>

                        {/* Questão mantida */}
                        <div className="flex items-start gap-2 mt-2 pl-6">
                          <span>
                            <span className="text-emerald-500 font-medium">Mantém #{p.keep_id}:</span>{" "}
                            <span className="text-muted-foreground">{p.keep_enun}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma questão repetida encontrada nesta disciplina. 🎉</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
