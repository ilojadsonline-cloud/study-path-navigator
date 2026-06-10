import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, Trash2, Eye, Clock, CheckCheck } from "lucide-react";

const PAGE_SIZE = 50;
const LETRAS = ["A", "B", "C", "D", "E"];

type PendingQuestao = {
  id: number;
  disciplina: string;
  assunto: string;
  dificuldade: string;
  enunciado: string;
  alt_a: string; alt_b: string; alt_c: string; alt_d: string; alt_e: string;
  gabarito: number;
  comentario: string;
  created_at: string;
};

const SELECT_COLS = "id,disciplina,assunto,dificuldade,enunciado,alt_a,alt_b,alt_c,alt_d,alt_e,gabarito,comentario,created_at";

export function PendingPublicationCard() {
  const [rows, setRows] = useState<PendingQuestao[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [filterDisc, setFilterDisc] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PendingQuestao | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (p: number, disc: string) => {
    setLoading(true);
    try {
      const from = p * PAGE_SIZE;
      let q = supabase
        .from("questoes")
        .select(SELECT_COLS, { count: "exact" })
        .eq("audit_status", "pending")
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (disc !== "all") q = q.eq("disciplina", disc);
      const { data, error, count } = await q;
      if (error) throw error;
      setRows((data as PendingQuestao[]) || []);
      setTotal(count ?? 0);
      setPage(p);
    } catch (e: any) {
      toast.error("Erro ao carregar pendentes", { description: e.message });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(0, "all");
    supabase.rpc("list_disciplinas").then(({ data }) => {
      if (data) setDisciplinas((data as { disciplina: string }[]).map((d) => d.disciplina));
    });
  }, [load]);

  const onDiscChange = (v: string) => {
    setFilterDisc(v);
    setSelected(new Set());
    load(0, v);
  };

  const goToPage = (p: number) => {
    const clamped = Math.min(Math.max(0, p), totalPages - 1);
    load(clamped, filterDisc);
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pageAllSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  // Seleciona TODAS as pendentes que batem com o filtro atual (só ids — leve)
  const selectAllMatching = async () => {
    setBusy(true);
    try {
      const ids: number[] = [];
      const STEP = 1000;
      for (let offset = 0; ; offset += STEP) {
        let q = supabase
          .from("questoes")
          .select("id")
          .eq("audit_status", "pending")
          .order("id", { ascending: false })
          .range(offset, offset + STEP - 1);
        if (filterDisc !== "all") q = q.eq("disciplina", filterDisc);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        ids.push(...data.map((d: any) => d.id));
        if (data.length < STEP) break;
      }
      setSelected(new Set(ids));
      toast.success(`${ids.length} questão(ões) selecionada(s)`);
    } catch (e: any) {
      toast.error("Erro ao selecionar todas", { description: e.message });
    }
    setBusy(false);
  };

  const clearSelection = () => setSelected(new Set());

  const publishSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const CHUNK = 200;
      let done = 0;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("questoes")
          .update({ audit_status: "approved", audit_status_updated_at: new Date().toISOString() })
          .in("id", slice);
        if (error) throw error;
        done += slice.length;
      }
      toast.success(`${done} questão(ões) publicada(s)`);
      setSelected(new Set());
      load(page, filterDisc);
    } catch (e: any) {
      toast.error("Erro ao publicar", { description: e.message });
    }
    setBusy(false);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setConfirmDelete(false);
    try {
      const ids = Array.from(selected);
      const { data, error } = await supabase.rpc("excluir_questoes_por_ids", { p_ids: ids });
      if (error) throw error;
      toast.success(`${data ?? ids.length} questão(ões) excluída(s)`);
      setSelected(new Set());
      load(page, filterDisc);
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    }
    setBusy(false);
  };

  return (
    <Card className="glass-card border-warning/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            Pendentes de publicação
            <Badge variant="secondary" className="ml-1">{total}</Badge>
          </span>
          <Button variant="outline" size="sm" onClick={() => load(page, filterDisc)} disabled={loading || busy}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Questões recém-geradas ficam aqui e <strong>não aparecem para os alunos</strong> até você publicá-las.
          Revise, selecione em lote e publique as boas — ou exclua as ruins.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterDisc} onValueChange={onDiscChange}>
            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Disciplina" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as disciplinas</SelectItem>
              {disciplinas.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={selectAllMatching} disabled={busy || loading || total === 0}>
            <CheckCheck className="w-3.5 h-3.5 mr-1" /> Selecionar todas ({total})
          </Button>
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={busy}>
              Limpar seleção
            </Button>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground font-bold"
            onClick={publishSelected}
            disabled={busy || selected.size === 0}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Publicar selecionadas ({selected.size})
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={busy || selected.size === 0}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir ({selected.size})
          </Button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            Nenhuma questão pendente de publicação. 🎉
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border/50">
              <Checkbox checked={pageAllSelected} onCheckedChange={togglePage} />
              <span className="text-xs text-muted-foreground">Selecionar página ({rows.length})</span>
            </div>
            <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
              {rows.map((r) => (
                <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/20">
                  <Checkbox className="mt-1" checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[11px] font-mono text-muted-foreground">#{r.id}</span>
                      <Badge variant="outline" className="text-[10px]">{r.disciplina}</Badge>
                      <span className="text-[11px] text-muted-foreground truncate">{r.assunto}</span>
                    </div>
                    <p className="text-sm line-clamp-2">{r.enunciado}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="Visualizar" onClick={() => setView(r)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paginação */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} · {selected.size} selecionada(s)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 0 || busy} onClick={() => goToPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || busy} onClick={() => goToPage(page + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Visualizar */}
      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono text-muted-foreground">Questão #{view?.id}</DialogTitle>
          </DialogHeader>
          {view && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{view.disciplina} · {view.assunto} · {view.dificuldade}</p>
                <p className="text-sm whitespace-pre-wrap">{view.enunciado}</p>
              </div>
              <div className="space-y-2">
                {[view.alt_a, view.alt_b, view.alt_c, view.alt_d, view.alt_e].map((alt, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${i === view.gabarito ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
                    <span className="font-bold text-xs mt-0.5" translate="no">{LETRAS[i]})</span>
                    <span>{alt}</span>
                    {i === view.gabarito && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-auto" />}
                  </div>
                ))}
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário:</p>
                <p className="text-sm whitespace-pre-wrap">{view.comentario}</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground font-bold"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { error } = await supabase
                      .from("questoes")
                      .update({ audit_status: "approved", audit_status_updated_at: new Date().toISOString() })
                      .eq("id", view.id);
                    setBusy(false);
                    if (error) { toast.error("Erro ao publicar", { description: error.message }); return; }
                    toast.success("Questão publicada");
                    setView(null);
                    load(page, filterDisc);
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Publicar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} questão(ões)?</AlertDialogTitle>
            <AlertDialogDescription>
              As questões serão removidas (com snapshot reversível) e não serão publicadas. Esta ação pode ser revertida pelo histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
