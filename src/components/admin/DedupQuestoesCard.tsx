import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Loader2, Search, Trash2 } from "lucide-react";

type DedupRow = {
  removed_id: number;
  kept_id: number;
  disciplina: string;
  sim_enun: number;
  sim_alts: number;
  removed_enun: string;
  kept_enun: string;
};

export function DedupQuestoesCard() {
  const [rows, setRows] = useState<DedupRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [threshEnun, setThreshEnun] = useState(0.82);
  const [threshAlts, setThreshAlts] = useState(0.78);

  const run = async (dryRun: boolean) => {
    dryRun ? setLoading(true) : setApplying(true);
    try {
      const { data, error } = await supabase.rpc("dedup_questoes", {
        p_dry_run: dryRun,
        p_threshold_enun: threshEnun,
        p_threshold_alts: threshAlts,
      });
      if (error) throw error;
      const result = (data as DedupRow[]) || [];
      setRows(result);
      if (dryRun) {
        toast.success(`${result.length} questões redundantes encontradas`, {
          description: result.length ? "Revise a lista e clique em Aplicar para ocultá-las." : "Nenhuma duplicata acima dos limiares atuais.",
        });
      } else {
        toast.success(`${result.length} questões ocultadas`, {
          description: "Marcadas como 'deleted'. Reversível na aba Questões (filtro Deletadas → Restaurar).",
        });
      }
    } catch (err: any) {
      toast.error("Erro na deduplicação", { description: err.message });
    } finally {
      dryRun ? setLoading(false) : setApplying(false);
    }
  };

  const disciplinasAfetadas = rows ? [...new Set(rows.map((r) => r.disciplina))] : [];

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="w-5 h-5 text-primary" />
          Deduplicação do banco (questões repetidas / similares)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          A auditoria por IA analisa uma questão por vez e não detecta repetição entre questões. Esta ferramenta
          compara TODAS as questões publicáveis de cada disciplina, mantém a melhor de cada grupo e oculta as
          redundantes (status <strong>deleted</strong>, reversível). Uma cópia de segurança é guardada antes de qualquer alteração.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Similaridade do enunciado (0–1)</Label>
            <Input
              type="number" step="0.01" min={0.5} max={1}
              value={threshEnun}
              onChange={(e) => setThreshEnun(Number(e.target.value))}
              className="w-28"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Similaridade das alternativas (0–1)</Label>
            <Input
              type="number" step="0.01" min={0.5} max={1}
              value={threshAlts}
              onChange={(e) => setThreshAlts(Number(e.target.value))}
              className="w-28"
            />
          </div>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Limiar menor = mais agressivo (remove mais). 0,82 é seguro para pegar quase-idênticas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run(true)} disabled={loading || applying} variant="secondary" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Simular (não altera nada)
          </Button>

          {rows && rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={applying || loading} variant="destructive" className="gap-2">
                  {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Aplicar — ocultar {rows.length} redundantes
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ocultar {rows.length} questões redundantes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    As questões selecionadas serão marcadas como <strong>deleted</strong> e deixarão de aparecer para os
                    alunos. A melhor questão de cada grupo é mantida. Esta ação é reversível: na aba Questões, filtro
                    "Deletadas", você pode restaurar qualquer uma.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run(false)}>Aplicar deduplicação</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {rows && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">{rows.length} redundantes</Badge>
              {disciplinasAfetadas.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {disciplinasAfetadas.length} disciplina(s) afetada(s)
                </span>
              )}
            </div>

            {rows.length > 0 && (
              <ScrollArea className="h-72 rounded-lg border border-border/40 p-2">
                <div className="space-y-2">
                  {rows.map((r) => (
                    <div key={`${r.removed_id}-${r.kept_id}`} className="text-xs p-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px]">{r.disciplina}</Badge>
                        <span className="text-destructive">remove #{r.removed_id}</span>
                        <span className="text-muted-foreground">→ mantém #{r.kept_id}</span>
                        <span className="text-muted-foreground">
                          (enun {(r.sim_enun * 100).toFixed(0)}% · alt {(r.sim_alts * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">{r.removed_enun}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
