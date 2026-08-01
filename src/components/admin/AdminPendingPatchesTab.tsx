import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, CheckCircle2, X, AlertTriangle,
  Pencil, Eye, ShieldCheck, FileWarning, Wand2, CheckSquare, Square,
} from "lucide-react";

type ProofMatrixEntry = {
  letter: string;
  text: string;
  verdict: boolean;
  literal_evidence: string;
  source_article?: string | null;
};

type PendingPatch = {
  id: number;
  questao_id: number;
  status: string;
  confidence: number | null;
  risk_level: string | null;
  issues: any[];
  proposed_patch: any;
  ai_summary: string | null;
  created_at: string;
};

const LETRAS = ["A", "B", "C", "D", "E"];
type BulkAction = "approve" | "reject" | "unrecoverable";

function extractProofMatrix(patch: any): ProofMatrixEntry[] {
  if (!patch || typeof patch !== "object") return [];
  const arr = (patch as any).__proof_matrix;
  return Array.isArray(arr) ? arr : [];
}

function extractRepairMeta(patch: any): { repair_type: string; source_articles: string[] } {
  if (!patch || typeof patch !== "object") return { repair_type: "none", source_articles: [] };
  return {
    repair_type: String((patch as any).__repair_type ?? "none"),
    source_articles: Array.isArray((patch as any).__source_articles) ? (patch as any).__source_articles : [],
  };
}

function patchToEditable(patch: any): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!patch || typeof patch !== "object") return out;
  for (const k of ["enunciado","alt_a","alt_b","alt_c","alt_d","alt_e","comentario"]) {
    if (k in patch) out[k] = String((patch as any)[k] ?? "");
  }
  if ("gabarito" in patch && typeof (patch as any).gabarito === "number") {
    out.gabarito = (patch as any).gabarito;
  }
  return out;
}

export function AdminPendingPatchesTab() {
  const { cursoId, cursoSlug } = useCurso();
  const [rows, setRows] = useState<PendingPatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PendingPatch | null>(null);
  const [questao, setQuestao] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editedPatch, setEditedPatch] = useState<Record<string, string | number>>({});
  const [acting, setActing] = useState(false);
  const [repairingId, setRepairingId] = useState<number | null>(null);

  // Bulk selection state
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; ok: number; fail: number }>({
    done: 0, total: 0, ok: 0, fail: 0,
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("question_audits")
      .select("*")
      .eq("status", "manual_review")
      .not("proposed_patch", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("Falha ao carregar patches: " + error.message);
    else {
      let list = (data ?? []) as PendingPatch[];
      // Restringe ao curso ativo
      const filter = cursoOrFilter(cursoId, cursoSlug);
      const qIds = [...new Set(list.map((r: any) => r.questao_id))];
      if (filter && qIds.length > 0) {
        const q = supabase.from("questoes").select("id").in("id", qIds);
        q.or(filter);
        const { data: qs } = await q;
        const allowed = new Set(((qs as any[]) || []).map((x) => x.id));
        list = list.filter((r: any) => allowed.has(r.questao_id));
      }
      setRows(list);
      // Limpa seleções que sumiram
      setChecked(prev => {
        const ids = new Set(list.map((d: any) => d.id));
        const next = new Set<number>();
        prev.forEach(id => { if (ids.has(id)) next.add(id); });
        return next;
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [cursoId, cursoSlug]);

  async function openDetail(p: PendingPatch) {
    setSelected(p);
    setEditing(false);
    setQuestao(null);
    const { data } = await supabase.from("questoes").select("*").eq("id", p.questao_id).single();
    if (data) setQuestao(data);
    setEditedPatch(patchToEditable(p.proposed_patch));
  }

  async function callApply(
    audit_id: number,
    action: "approve" | "edit_approve" | "reject" | "unrecoverable",
    edited_patch?: Record<string, unknown>,
  ) {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-audit-patch", {
        body: { audit_id, action, edited_patch },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        action === "approve" ? "Patch aprovado e aplicado"
        : action === "edit_approve" ? "Patch editado e aplicado"
        : action === "reject" ? "Patch rejeitado"
        : "Questão marcada como irrecuperável (soft delete)"
      );
      setSelected(null);
      setQuestao(null);
      setRows(prev => prev.filter(r => r.id !== audit_id));
      setChecked(prev => { const n = new Set(prev); n.delete(audit_id); return n; });
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? e));
    } finally {
      setActing(false);
    }
  }

  async function triggerRepair(questaoId: number) {
    setRepairingId(questaoId);
    try {
      const { data, error } = await supabase.functions.invoke("audit-questions", {
        body: { action: "repair", question_id: questaoId },
      });
      if (error) throw error;
      const summary = (data as any)?.summary ?? "Repair concluído";
      toast.success(summary);
      await load();
    } catch (e: any) {
      toast.error("Falha no repair: " + (e?.message ?? e));
    } finally {
      setRepairingId(null);
    }
  }

  // ===== Bulk =====
  const allVisibleIds = useMemo(() => rows.map(r => r.id), [rows]);
  const allChecked = checked.size > 0 && allVisibleIds.every(id => checked.has(id));
  const someChecked = checked.size > 0 && !allChecked;

  function toggleOne(id: number, v: boolean) {
    setChecked(prev => {
      const n = new Set(prev);
      if (v) n.add(id); else n.delete(id);
      return n;
    });
  }
  function toggleAll(v: boolean) {
    setChecked(v ? new Set(allVisibleIds) : new Set());
  }

  async function runBulk(action: BulkAction) {
    const ids = Array.from(checked);
    if (ids.length === 0) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: ids.length, ok: 0, fail: 0 });

    const CONC = 4;
    let cursor = 0;
    let ok = 0;
    let fail = 0;
    const okIds: number[] = [];

    async function worker() {
      while (cursor < ids.length) {
        const idx = cursor++;
        const audit_id = ids[idx];
        try {
          const { data, error } = await supabase.functions.invoke("apply-audit-patch", {
            body: { audit_id, action },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          ok++; okIds.push(audit_id);
        } catch (e: any) {
          fail++;
          console.error("bulk apply fail", audit_id, e?.message ?? e);
        } finally {
          setBulkProgress(p => ({ ...p, done: p.done + 1, ok, fail }));
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONC, ids.length) }, worker));

    if (okIds.length > 0) {
      const okSet = new Set(okIds);
      setRows(prev => prev.filter(r => !okSet.has(r.id)));
      setChecked(prev => {
        const n = new Set(prev);
        okIds.forEach(id => n.delete(id));
        return n;
      });
    }
    setBulkRunning(false);
    setBulkAction(null);
    toast[fail === 0 ? "success" : "warning"](
      `Bulk ${action}: ${ok} aplicado(s), ${fail} falha(s).`
    );
  }

  const bulkLabel: Record<BulkAction, string> = {
    approve: "Aprovar selecionados",
    reject: "Rejeitar selecionados",
    unrecoverable: "Marcar como irrecuperáveis",
  };
  const bulkConfirm: Record<BulkAction, { title: string; desc: string }> = {
    approve: {
      title: "Aprovar patches em lote?",
      desc: "Cada patch será aplicado à questão original. As versões anteriores ficam salvas em question_versions. Esta ação é em massa — confira a lista antes de continuar.",
    },
    reject: {
      title: "Rejeitar patches em lote?",
      desc: "As questões originais permanecem intactas e os patches serão descartados. As auditorias saem da fila de revisão.",
    },
    unrecoverable: {
      title: "Marcar questões como irrecuperáveis?",
      desc: "As questões serão soft-deletadas (audit_status = 'deleted') e ficam ocultas para os alunos. Use apenas quando o repair não é viável.",
    },
  };

  const proofMatrix = extractProofMatrix(selected?.proposed_patch);
  const repairMeta = extractRepairMeta(selected?.proposed_patch);

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-primary" />
              Patches pendentes (modo repair)
            </span>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading || bulkRunning}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Reescritas geradas pela IA jurídica (DeepSeek Reasoner) que NÃO passaram nos critérios de auto-aplicação
            (confidence ≥ 0.9, risk = low, proof_matrix válida). Selecione várias para aplicar ações em lote.
          </p>
        </CardHeader>
        <CardContent>
          {/* Barra de ações em lote */}
          <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-lg border border-border/40 bg-muted/20">
            <button
              type="button"
              onClick={() => toggleAll(!allChecked)}
              className="flex items-center gap-2 text-xs hover:text-primary"
              disabled={bulkRunning || rows.length === 0}
            >
              {allChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allChecked ? "Desmarcar todos" : someChecked ? `Selecionar todos (${rows.length})` : `Selecionar todos (${rows.length})`}
            </button>
            <Badge variant="outline" className="text-[10px]">
              {checked.size} selecionado(s)
            </Badge>
            <div className="flex-1" />
            <Button
              size="sm"
              disabled={checked.size === 0 || bulkRunning}
              onClick={() => setBulkAction("approve")}
              className="gap-1"
            >
              <ShieldCheck className="w-4 h-4" /> Aprovar ({checked.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={checked.size === 0 || bulkRunning}
              onClick={() => setBulkAction("reject")}
              className="gap-1"
            >
              <X className="w-4 h-4" /> Rejeitar ({checked.size})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={checked.size === 0 || bulkRunning}
              onClick={() => setBulkAction("unrecoverable")}
              className="gap-1"
            >
              <AlertTriangle className="w-4 h-4" /> Irrecuperáveis ({checked.size})
            </Button>
          </div>

          {bulkRunning && (
            <div className="mb-3 p-2 rounded-lg border border-primary/30 bg-primary/5 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando lote: {bulkProgress.done}/{bulkProgress.total} (ok: {bulkProgress.ok}, falhas: {bulkProgress.fail})
            </div>
          )}

          <ScrollArea className="h-[560px]">
            <div className="space-y-2">
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum patch pendente. Use a aba "Auditoria" para gerar repairs ou rode o botão "Pedir repair" em uma questão.
                </p>
              )}
              {rows.map(r => {
                const matrix = extractProofMatrix(r.proposed_patch);
                const provesOk = matrix.filter(m => m.verdict !== undefined).length;
                const trueCount = matrix.filter(m => m.verdict === true).length;
                const isChecked = checked.has(r.id);
                return (
                  <div
                    key={r.id}
                    className={`flex items-start gap-2 p-3 rounded-lg border transition ${
                      isChecked ? "border-primary/60 bg-primary/5" : "border-border/40 bg-card/50 hover:bg-card/80"
                    }`}
                  >
                    <div className="pt-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => toggleOne(r.id, !!v)}
                        disabled={bulkRunning}
                        aria-label={`Selecionar patch ${r.id}`}
                      />
                    </div>
                    <button onClick={() => openDetail(r)} className="flex-1 text-left flex items-start justify-between gap-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="destructive">Patch pendente</Badge>
                          <span className="text-xs font-mono text-muted-foreground">ID #{r.questao_id}</span>
                          {r.confidence != null && (
                            <span className="text-xs text-muted-foreground">conf: {(r.confidence * 100).toFixed(0)}%</span>
                          )}
                          {r.risk_level && <span className="text-xs text-muted-foreground">risco: {r.risk_level}</span>}
                          <Badge variant="outline" className="text-[10px]">
                            proof: {provesOk}/5 · true: {trueCount}
                          </Badge>
                        </div>
                        <p className="text-sm truncate">{r.ai_summary ?? "(sem resumo da IA)"}</p>
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Repair por ID */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" /> Pedir repair em uma questão (por ID)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RepairById onRepair={triggerRepair} running={repairingId !== null} />
        </CardContent>
      </Card>

      {/* Confirm bulk */}
      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => { if (!o && !bulkRunning) setBulkAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkAction ? bulkConfirm[bulkAction].title : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction ? bulkConfirm[bulkAction].desc : ""}
              <br /><br />
              <strong>{checked.size}</strong> patch(es) serão processados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkRunning}
              onClick={(e) => { e.preventDefault(); if (bulkAction) runBulk(bulkAction); }}
            >
              {bulkRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {bulkAction ? bulkLabel[bulkAction] : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setQuestao(null); setEditing(false); } }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Patch pendente — Questão #{selected?.questao_id}
              {selected?.confidence != null && <Badge variant="outline">conf: {(selected.confidence * 100).toFixed(0)}%</Badge>}
              {selected?.risk_level && <Badge variant="outline">risco: {selected.risk_level}</Badge>}
              <Badge variant="secondary">tipo: {repairMeta.repair_type}</Badge>
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-2">
                <div>
                  <strong className="text-xs uppercase text-muted-foreground">Diagnóstico da IA:</strong>
                  <p className="mt-1 whitespace-pre-wrap">{selected.ai_summary ?? "(sem resumo)"}</p>
                </div>
                {selected.issues?.length > 0 && (
                  <div>
                    <strong className="text-xs uppercase text-muted-foreground">Issues:</strong>
                    <ul className="mt-1 space-y-1">
                      {selected.issues.map((i: any, idx: number) => (
                        <li key={idx} className="text-xs">
                          <Badge variant="outline" className="mr-1 text-[10px]">{i.type}</Badge>
                          {i.severity && <Badge variant="secondary" className="mr-1 text-[10px]">{i.severity}</Badge>}
                          <span className="text-muted-foreground">{i.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {repairMeta.source_articles.length > 0 && (
                  <div className="text-xs">
                    <strong className="uppercase text-muted-foreground">Artigos fonte: </strong>
                    {repairMeta.source_articles.join(", ")}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-xs uppercase">Proof matrix (prova literal por alternativa)</strong>
                  <Badge variant={proofMatrix.length === 5 && proofMatrix.filter(m => m.verdict).length === 1 ? "default" : "destructive"}>
                    {proofMatrix.filter(m => m.verdict).length}/1 corretas · {proofMatrix.length}/5 entradas
                  </Badge>
                </div>
                {proofMatrix.length === 0 ? (
                  <p className="text-xs text-destructive">⚠ Sem proof_matrix anexada — patch não passou pela validação literal.</p>
                ) : (
                  <div className="space-y-2">
                    {proofMatrix.map((e, idx) => (
                      <div key={idx} className={`p-2 rounded border ${e.verdict ? "border-green-500/40 bg-green-500/5" : "border-border/40 bg-background/40"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={e.verdict ? "default" : "outline"}>{e.letter}</Badge>
                          {e.verdict && <Badge className="bg-green-600/80">CORRETA</Badge>}
                          {e.source_article && <span className="text-xs text-muted-foreground">📘 {e.source_article}</span>}
                        </div>
                        <p className="text-xs mb-1"><strong>Texto:</strong> {e.text}</p>
                        <p className="text-xs italic text-muted-foreground">
                          <strong>Evidência literal:</strong> "{e.literal_evidence}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {questao ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <strong className="text-xs uppercase text-muted-foreground">Original</strong>
                    <FieldsView data={questao} />
                  </div>
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <strong className="text-xs uppercase text-primary">Patch proposto</strong>
                    {editing ? (
                      <FieldsEdit form={editedPatch} setForm={setEditedPatch} />
                    ) : (
                      <FieldsView data={{ ...questao, ...editedPatch }} highlight={editedPatch} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between border-t border-border/40 pt-3">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="destructive"
                size="sm"
                disabled={acting || !selected}
                onClick={() => selected && callApply(selected.id, "unrecoverable")}
                className="gap-1"
              >
                <AlertTriangle className="w-4 h-4" /> Marcar irrecuperável
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={acting || !selected}
                onClick={() => selected && callApply(selected.id, "reject")}
                className="gap-1"
              >
                <X className="w-4 h-4" /> Rejeitar (manter original)
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1">
                  <Pencil className="w-4 h-4" /> Editar antes de aprovar
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1">
                  <Eye className="w-4 h-4" /> Cancelar edição
                </Button>
              )}
              {editing ? (
                <Button
                  size="sm"
                  disabled={acting || !selected}
                  onClick={() => selected && callApply(selected.id, "edit_approve", editedPatch)}
                  className="gap-1"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Salvar edição e aprovar
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={acting || !selected}
                  onClick={() => selected && callApply(selected.id, "approve")}
                  className="gap-1"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Aprovar patch
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldsView({ data, highlight }: { data: any; highlight?: Record<string, any> }) {
  const fields: Array<[string, string]> = [
    ["enunciado", "Enunciado"],
    ["alt_a", "Alt A"], ["alt_b", "Alt B"], ["alt_c", "Alt C"], ["alt_d", "Alt D"], ["alt_e", "Alt E"],
    ["comentario", "Comentário"],
  ];
  const gabIdx = typeof data?.gabarito === "number" ? data.gabarito : -1;
  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs"><strong>Gabarito:</strong> {gabIdx >= 0 ? LETRAS[gabIdx] : "?"} ({gabIdx})</p>
      {fields.map(([k, label]) => {
        const v = String(data?.[k] ?? "");
        const isHighlighted = !!highlight && k in highlight;
        return (
          <div key={k} className={`text-xs ${isHighlighted ? "rounded bg-yellow-500/10 border border-yellow-500/30 p-1" : ""}`}>
            <strong className="text-muted-foreground">{label}:</strong> {v.slice(0, 600)}{v.length > 600 ? "…" : ""}
          </div>
        );
      })}
    </div>
  );
}

function FieldsEdit({ form, setForm }: { form: Record<string, string | number>; setForm: (f: Record<string, string | number>) => void }) {
  const fields: Array<[string, string]> = [
    ["alt_a", "Alt A"], ["alt_b", "Alt B"], ["alt_c", "Alt C"], ["alt_d", "Alt D"], ["alt_e", "Alt E"],
  ];
  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Gabarito</Label>
        <div className="flex gap-1">
          {LETRAS.map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => setForm({ ...form, gabarito: i })}
              className={`w-7 h-7 rounded-full border text-xs font-bold ${
                form.gabarito === i ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary/60"
              }`}
            >{l}</button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs">Enunciado</Label>
        <Textarea
          value={String(form.enunciado ?? "")}
          onChange={e => setForm({ ...form, enunciado: e.target.value })}
          rows={3}
        />
      </div>
      {fields.map(([k, label]) => (
        <div key={k}>
          <Label className="text-xs">{label}</Label>
          <Textarea
            value={String(form[k] ?? "")}
            onChange={e => setForm({ ...form, [k]: e.target.value })}
            rows={2}
          />
        </div>
      ))}
      <div>
        <Label className="text-xs">Comentário</Label>
        <Textarea
          value={String(form.comentario ?? "")}
          onChange={e => setForm({ ...form, comentario: e.target.value })}
          rows={4}
        />
      </div>
    </div>
  );
}

function RepairById({ onRepair, running }: { onRepair: (id: number) => void; running: boolean }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        placeholder="ID da questão"
        value={val}
        onChange={e => setVal(e.target.value)}
        className="w-40"
        disabled={running}
      />
      <Button
        size="sm"
        disabled={running || !val}
        onClick={() => { const n = Number(val); if (Number.isInteger(n) && n > 0) onRepair(n); }}
        className="gap-1"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        Pedir repair
      </Button>
      <p className="text-xs text-muted-foreground">
        Dispara o modo REPAIR (DeepSeek Reasoner + proof_matrix). Se passar nos critérios, aplica automaticamente; senão, aparece nesta fila.
      </p>
    </div>
  );
}
