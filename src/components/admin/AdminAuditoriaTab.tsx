import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play, Square, RefreshCw, AlertTriangle, CheckCircle2, Eye, Undo2, Save, Pencil, Trash2, X, ShieldCheck, Wand2 } from "lucide-react";

// Filtros amigáveis em português
const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "Pendentes" },
  { key: "session", label: "Processo atual" },
  { key: "auto_fixed", label: "Corrigidas pela IA" },
  { key: "approved", label: "Aprovadas" },
  { key: "manual_review", label: "Precisa revisão manual" },
  { key: "error", label: "Erros" },
];

const OPEN_AUDIT_STATUSES = ["manual_review", "pending", "error"];
const SESSION_AUDIT_STATUSES = ["auto_fixed", "approved", "manual_review", "pending", "error"];

const STATUS_LABEL: Record<string, string> = {
  manual_review: "Precisa revisão",
  auto_fixed: "Corrigida pela IA",
  approved: "Aprovada",
  rejected: "Rejeitada",
  error: "Erro",
  pending: "Pendente",
};

type AuditJob = {
  id: string;
  status: string;
  total: number;
  processed: number;
  auto_fixed: number;
  flagged: number;
  errors: number;
  scope: any;
  last_error?: string | null;
  created_at: string;
};

type AuditRow = {
  id: number;
  questao_id: number;
  status: string;
  confidence: number | null;
  risk_level: string | null;
  issues: any[];
  proposed_patch: any;
  applied_patch: any;
  ai_summary: string | null;
  created_at: string;
};

type QuestaoForm = {
  enunciado: string;
  alt_a: string;
  alt_b: string;
  alt_c: string;
  alt_d: string;
  alt_e: string;
  gabarito: number;
  comentario: string;
  disciplina: string;
  assunto: string;
  dificuldade: string;
};

const LETRAS = ["A", "B", "C", "D", "E"];

export function AdminAuditoriaTab() {
  const [selDisc, setSelDisc] = useState<string[]>([]);
  const [onlyUnaudited, setOnlyUnaudited] = useState(false);
  const [limit, setLimit] = useState(100000);
  const [job, setJob] = useState<AuditJob | null>(null);
  const [running, setRunning] = useState(false);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [questao, setQuestao] = useState<any>(null);
  const [form, setForm] = useState<QuestaoForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const stopRef = useRef(false);
  const filterStatusRef = useRef(filterStatus);

  useEffect(() => { filterStatusRef.current = filterStatus; }, [filterStatus]);

  async function loadDisciplinas() {
    const { data, error } = await supabase.rpc("list_disciplinas");
    if (error) {
      toast.error("Erro ao carregar disciplinas: " + error.message);
      return;
    }
    setDisciplinas((data ?? []).map((r: any) => r.disciplina).filter(Boolean));
  }

  async function loadLatestRunningJob() {
    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("audit_jobs")
      .select("*")
      .eq("status", "running")
      .gte("updated_at", recentCutoff)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setJob(data as AuditJob);
  }

  async function loadAudits(statusOverride = filterStatus, activeJob = job) {
    setLoading(true);
    let q = supabase.from("question_audits").select("*").order("created_at", { ascending: false }).limit(100);
    if (statusOverride === "open") q = q.in("status", OPEN_AUDIT_STATUSES);
    else if (statusOverride === "session") q = q.in("status", SESSION_AUDIT_STATUSES).gte("created_at", activeJob?.created_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    else q = q.eq("status", statusOverride);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setAudits((data ?? []) as AuditRow[]);
    setLoading(false);
  }

  useEffect(() => { loadDisciplinas(); loadLatestRunningJob(); }, []);
  useEffect(() => { loadAudits(); }, [filterStatus, job?.id]);

  async function startJob() {
    stopRef.current = false;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("audit-questions", {
        body: {
          action: "start",
          disciplinas: selDisc.length ? selDisc : null,
          only_unaudited: onlyUnaudited,
          limit,
        },
      });
      if (error) throw error;
      const j = data.job as AuditJob;
      setJob(j);
      setFilterStatus("session");
      toast.success(`Auditoria iniciada (${j.total} questões)`);
      runLoop(j.id);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao iniciar");
      setRunning(false);
    }
  }

  async function runLoop(jobId: string) {
    let consecutiveFailures = 0;
    while (!stopRef.current) {
      try {
        const { data, error } = await supabase.functions.invoke("audit-questions", {
          body: { action: "run", job_id: jobId },
        });
        if (error) throw error;
        consecutiveFailures = 0;
        let currentJob = data?.job as AuditJob | undefined;
        if (currentJob) setJob(currentJob);
        else {
          const status = await supabase.functions.invoke("audit-questions", {
            body: { action: "status", job_id: jobId },
          });
          if (status.data?.job) {
            currentJob = status.data.job as AuditJob;
            setJob(currentJob);
          }
        }
        if (["session", "auto_fixed", "approved", "manual_review", "error"].includes(filterStatusRef.current)) {
          loadAudits(filterStatusRef.current, currentJob ?? job);
        }
        if (data?.done) {
          toast.success("Auditoria concluída!");
          filterStatusRef.current = "open";
          setFilterStatus("open");
          break;
        }
      } catch (e: any) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          toast.error(`Auditoria pausada após falhas repetidas: ${e.message}`);
          break;
        }
        toast.warning(`Lote falhou; tentando novamente (${consecutiveFailures}/3)…`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    setRunning(false);
    loadAudits(filterStatusRef.current, job);
  }

  async function resumeJob() {
    if (!job || job.status !== "running") return;
    stopRef.current = false;
    setRunning(true);
    setFilterStatus("session");
    runLoop(job.id);
  }

  async function cancel() {
    if (!job) return;
    stopRef.current = true;
    await supabase.functions.invoke("audit-questions", {
      body: { action: "cancel", job_id: job.id },
    });
    toast.info("Cancelando...");
  }

  // Remove da fila quando o admin já resolveu a pendência.
  function removeFromListIfResolved(auditId: number, newStatus: string) {
    const stillVisible =
      (filterStatus === "open" && OPEN_AUDIT_STATUSES.includes(newStatus)) ||
      filterStatus === newStatus;
    if (stillVisible) setAudits(prev => prev.map(x => x.id === auditId ? { ...x, status: newStatus } : x));
    else setAudits(prev => prev.filter(x => x.id !== auditId));
  }

  async function closeSiblingAudits(questaoId: number, keepAuditId: number) {
    await supabase
      .from("question_audits")
      .update({ status: "superseded" })
      .eq("questao_id", questaoId)
      .neq("id", keepAuditId)
      .in("status", OPEN_AUDIT_STATUSES);
    setAudits(prev => prev.filter(x => x.questao_id !== questaoId || x.id === keepAuditId));
  }

  // Aplica a sugestão da IA tal como veio
  async function applyAISuggestion(a: AuditRow) {
    if (!a.proposed_patch) {
      await supabase.from("question_audits").update({ status: "approved" }).eq("id", a.id);
      toast.success("Auditoria marcada como aprovada");
      await closeSiblingAudits(a.questao_id, a.id);
      removeFromListIfResolved(a.id, "approved");
      setDetail(null); setQuestao(null); setForm(null);
      return;
    }
    const { data: q } = await supabase.from("questoes").select("*").eq("id", a.questao_id).single();
    if (q) {
      await supabase.from("question_versions").insert({
        questao_id: a.questao_id,
        snapshot: q,
        change_reason: "apply_ai_suggestion",
        audit_id: a.id,
      } as any);
    }
    // Sanitiza patch (gabarito 0-4)
    const patch: any = { ...(a.proposed_patch as any) };
    if ("gabarito" in patch) {
      const g = Number(patch.gabarito);
      if (!Number.isInteger(g) || g < 0 || g > 4) delete patch.gabarito;
    }
    const { error: upErr } = await supabase.from("questoes").update(patch).eq("id", a.questao_id);
    if (upErr) { toast.error("Falha ao atualizar questão: " + upErr.message); return; }
    await supabase.from("question_audits").update({
      status: "auto_fixed",
      applied_patch: patch,
    }).eq("id", a.id);
    toast.success(`Questão #${a.questao_id} corrigida pela IA`);
    await closeSiblingAudits(a.questao_id, a.id);
    removeFromListIfResolved(a.id, "auto_fixed");
    setDetail(null); setQuestao(null); setForm(null);
  }

  // Aplica TODAS as sugestões pendentes (manual_review + auto_fixed sem aplicar) em lote
  async function applyAllAISuggestions() {
    if (!confirm("Aplicar TODAS as sugestões pendentes da IA às questões? Cada questão original será salva como snapshot e pode ser revertida individualmente.")) return;
    setBulkApplying(true);
    try {
      const { data: pending, error } = await supabase
        .from("question_audits")
        .select("*")
        .in("status", ["manual_review", "pending"])
        .not("proposed_patch", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const list = (pending ?? []) as AuditRow[];
      setBulkProgress({ done: 0, total: list.length });
      if (list.length === 0) {
        toast.info("Não há sugestões pendentes da IA para aplicar.");
        return;
      }
      let applied = 0, failed = 0;
      for (const a of list) {
        try {
          const { data: q } = await supabase.from("questoes").select("*").eq("id", a.questao_id).single();
          if (q) {
            await supabase.from("question_versions").insert({
              questao_id: a.questao_id,
              snapshot: q,
              change_reason: "bulk_apply_ai_suggestion",
              audit_id: a.id,
            } as any);
          }
          // Sanitiza patch (gabarito 0-4)
          const patch: any = { ...(a.proposed_patch as any) };
          if ("gabarito" in patch) {
            const g = Number(patch.gabarito);
            if (!Number.isInteger(g) || g < 0 || g > 4) delete patch.gabarito;
          }
          const { error: upErr } = await supabase.from("questoes").update(patch).eq("id", a.questao_id);
          if (upErr) throw upErr;
          await supabase.from("question_audits").update({
            status: "auto_fixed",
            applied_patch: patch,
          }).eq("id", a.id);
          await closeSiblingAudits(a.questao_id, a.id);
          applied++;
          removeFromListIfResolved(a.id, "auto_fixed");
        } catch (e: any) {
          failed++;
          console.error("bulk apply falhou", a.id, e?.message);
        }
        setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      }
      toast.success(`Concluído: ${applied} aplicadas, ${failed} falharam`);
    } catch (e: any) {
      toast.error("Falha no lote: " + (e?.message ?? e));
    } finally {
      setBulkApplying(false);
    }
  }

  async function dismissAudit(a: AuditRow) {
    await supabase.from("question_audits").update({ status: "rejected" }).eq("id", a.id);
    toast.success("Auditoria descartada (questão mantida como está)");
    await closeSiblingAudits(a.questao_id, a.id);
    removeFromListIfResolved(a.id, "rejected");
    setDetail(null); setQuestao(null); setForm(null);
  }

  async function revertAudit(a: AuditRow) {
    const { data: ver } = await supabase
      .from("question_versions")
      .select("*")
      .eq("audit_id", a.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ver) return toast.error("Sem snapshot para reverter");
    const snap: any = ver.snapshot;
    const { id, created_at, ...rest } = snap;
    await supabase.from("questoes").update(rest).eq("id", a.questao_id);
    await supabase.from("question_audits").update({ status: "rejected" }).eq("id", a.id);
    toast.success("Questão revertida ao estado anterior");
    await closeSiblingAudits(a.questao_id, a.id);
    removeFromListIfResolved(a.id, "rejected");
    setDetail(null); setQuestao(null); setForm(null);
  }

  async function deleteQuestao(a: AuditRow) {
    if (!confirm(`Excluir definitivamente a questão #${a.questao_id} do banco? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("questoes").delete().eq("id", a.questao_id);
    if (error) return toast.error(error.message);
    await supabase.from("question_audits").update({ status: "rejected", ai_summary: "Questão excluída pelo admin" }).eq("id", a.id);
    toast.success(`Questão #${a.questao_id} excluída do banco`);
    await closeSiblingAudits(a.questao_id, a.id);
    setDetail(null);
    setQuestao(null);
    setForm(null);
    setAudits(prev => prev.filter(x => x.id !== a.id));
  }

  async function openDetail(a: AuditRow) {
    setDetail(a);
    setForm(null);
    setQuestao(null);
    const { data } = await supabase.from("questoes").select("*").eq("id", a.questao_id).single();
    if (data) {
      setQuestao(data);
      // Pre-popula formulário com sugestão da IA mesclada (se houver)
      const patch = a.proposed_patch ?? {};
      setForm({
        enunciado: patch.enunciado ?? data.enunciado ?? "",
        alt_a: patch.alt_a ?? data.alt_a ?? "",
        alt_b: patch.alt_b ?? data.alt_b ?? "",
        alt_c: patch.alt_c ?? data.alt_c ?? "",
        alt_d: patch.alt_d ?? data.alt_d ?? "",
        alt_e: patch.alt_e ?? data.alt_e ?? "",
        gabarito: typeof patch.gabarito === "number" ? patch.gabarito : data.gabarito ?? 0,
        comentario: patch.comentario ?? data.comentario ?? "",
        disciplina: data.disciplina ?? "",
        assunto: data.assunto ?? "",
        dificuldade: data.dificuldade ?? "Médio",
      });
    }
  }

  async function saveManualEdit() {
    if (!detail || !form || !questao) return;
    setSaving(true);
    try {
      // Snapshot do estado atual antes de sobrescrever
      await supabase.from("question_versions").insert({
        questao_id: detail.questao_id,
        snapshot: questao,
        change_reason: "manual_edit_in_audit",
        audit_id: detail.id,
      } as any);
      const patch = {
        enunciado: form.enunciado,
        alt_a: form.alt_a,
        alt_b: form.alt_b,
        alt_c: form.alt_c,
        alt_d: form.alt_d,
        alt_e: form.alt_e,
        gabarito: Math.max(0, Math.min(4, Number(form.gabarito) || 0)),
        comentario: form.comentario,
        disciplina: form.disciplina,
        assunto: form.assunto,
        dificuldade: form.dificuldade,
      };
      const { error } = await supabase.from("questoes").update(patch).eq("id", detail.questao_id);
      if (error) throw error;
      await supabase.from("question_audits").update({
        status: "approved",
        applied_patch: patch,
      }).eq("id", detail.id);
      toast.success(`Questão #${detail.questao_id} corrigida e auditoria aprovada`);
      const auditId = detail.id;
      await closeSiblingAudits(detail.questao_id, auditId);
      setDetail(null);
      setForm(null);
      setQuestao(null);
      removeFromListIfResolved(auditId, "approved");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Validação Avançada de Questões (IA)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Aprimoramento da validação tradicional: a IA revisa cada questão buscando erros de gabarito,
            alternativas duplicadas, comentário fraco ou divergência com a lei. Você pode aplicar a sugestão dela,
            editar manualmente ou excluir a questão.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Disciplinas a auditar (vazio = todas):</p>
              <Button size="sm" variant="ghost" onClick={loadDisciplinas} className="h-6 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {disciplinas.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Carregando disciplinas...</span>
              )}
              {disciplinas.map(d => (
                <Badge
                  key={d}
                  variant={selDisc.includes(d) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setSelDisc(s => s.includes(d) ? s.filter(x => x !== d) : [...s, d])
                  }
                >{d}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyUnaudited} onCheckedChange={(v) => setOnlyUnaudited(!!v)} />
              Auditar apenas questões nunca revisadas
            </label>
            <label className="flex items-center gap-2 text-sm">
              Quantas questões:
              <Input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} className="w-24" />
            </label>
          </div>
          <div className="flex gap-2">
            {!running ? (
              <>
                {job?.status === "running" && (
                  <Button onClick={resumeJob} variant="secondary" className="gap-2">
                    <Play className="w-4 h-4" />Continuar auditoria
                  </Button>
                )}
                <Button onClick={startJob} className="gap-2">
                  <Play className="w-4 h-4" />Iniciar nova auditoria
                </Button>
              </>
            ) : (
              <Button onClick={cancel} variant="destructive" className="gap-2">
                <Square className="w-4 h-4" />Parar auditoria
              </Button>
            )}
          </div>

          {job && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex justify-between text-sm">
                <span>Status: <Badge>{job.status}</Badge></span>
                <span>{job.processed} / {job.total}</span>
              </div>
              <Progress value={job.total ? (job.processed / job.total) * 100 : 0} />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="text-green-500">✓ Corrigidas pela IA: {job.auto_fixed}</span>
                <span className="text-yellow-500">⚠ Precisam revisão: {job.flagged}</span>
                <span className="text-red-500">✗ Erros: {job.errors}</span>
              </div>
              {job.last_error && <p className="text-xs text-red-500">Último erro: {job.last_error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span>Questões auditadas</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={applyAllAISuggestions}
                disabled={bulkApplying}
                className="gap-1"
                title="Aplica de uma vez todas as correções sugeridas pela IA nas questões pendentes"
              >
                {bulkApplying
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando {bulkProgress.done}/{bulkProgress.total}…</>
                  : <><Wand2 className="w-4 h-4" /> Aplicar todas as sugestões da IA</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => loadAudits()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Clique em uma questão para abrir e revisar individualmente, ou use "Aplicar todas" para
            aprovar em massa as correções sugeridas pela IA. Cada alteração gera snapshot reversível.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <Badge
                key={s.key}
                variant={filterStatus === s.key ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterStatus(s.key)}
              >{s.label}</Badge>
            ))}
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {audits.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma questão neste filtro.
                </p>
              )}
              {audits.map(a => (
                <button
                  key={a.id}
                  onClick={() => openDetail(a)}
                  className="w-full text-left p-3 rounded-lg border border-border/40 bg-card/50 hover:bg-card/80 hover:border-primary/40 transition flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={a.status === "auto_fixed" ? "default" : a.status === "manual_review" ? "destructive" : "outline"}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground" title="ID original da questão no banco">ID banco: #{a.questao_id}</span>
                      {a.confidence != null && (
                        <span className="text-xs text-muted-foreground">confiança: {(a.confidence * 100).toFixed(0)}%</span>
                      )}
                      {a.risk_level && (
                        <span className="text-xs text-muted-foreground">risco: {a.risk_level}</span>
                      )}
                    </div>
                    <p className="text-sm truncate">{a.ai_summary ?? "(sem resumo da IA)"}</p>
                    {a.issues?.length > 0 && (
                      <p className="text-xs text-yellow-500 mt-1">
                        {a.issues.length} problema(s) encontrado(s): {a.issues.map((i: any) => i.type).join(", ")}
                      </p>
                    )}
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setQuestao(null); setForm(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Corrigir questão — ID original no banco: <span className="font-mono">#{detail?.questao_id}</span>
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 text-sm">
              {/* Resumo da auditoria */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-2">
                <div>
                  <strong className="text-xs uppercase text-muted-foreground">O que a IA disse:</strong>
                  <p className="mt-1">{detail.ai_summary ?? "(sem resumo)"}</p>
                </div>
                {detail.issues?.length > 0 && (
                  <div>
                    <strong className="text-xs uppercase text-muted-foreground">Problemas detectados:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {detail.issues.map((i: any, idx: number) => (
                        <li key={idx} className="text-xs">
                          <span className="font-mono">{i.type}</span>
                          {i.severity && <Badge variant="outline" className="ml-1 text-[10px]">{i.severity}</Badge>}
                          {i.description && <span className="text-muted-foreground"> — {i.description}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.proposed_patch && (
                  <p className="text-xs text-primary">
                    💡 Os campos abaixo já foram preenchidos com a sugestão da IA. Revise e ajuste o que precisar.
                  </p>
                )}
              </div>

              {/* Formulário inline de edição */}
              {form ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Disciplina</Label>
                      <Input value={form.disciplina} onChange={e => setForm({ ...form, disciplina: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Assunto</Label>
                      <Input value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Dificuldade</Label>
                      <Input value={form.dificuldade} onChange={e => setForm({ ...form, dificuldade: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Enunciado</Label>
                    <Textarea
                      value={form.enunciado}
                      onChange={e => setForm({ ...form, enunciado: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Alternativas (clique no círculo para marcar a correta)</Label>
                    {(["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const).map((key, idx) => (
                      <div key={key} className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, gabarito: idx })}
                          className={`mt-2 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition ${
                            form.gabarito === idx
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border hover:border-primary/60"
                          }`}
                          title={form.gabarito === idx ? "Correta" : "Marcar como correta"}
                        >
                          {LETRAS[idx]}
                        </button>
                        <Textarea
                          value={form[key]}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          rows={2}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label className="text-xs">Comentário do professor</Label>
                    <Textarea
                      value={form.comentario}
                      onChange={e => setForm({ ...form, comentario: e.target.value })}
                      rows={5}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between border-t border-border/40 pt-4">
            <div className="flex gap-2 flex-wrap">
              {detail && detail.status === "auto_fixed" && (
                <Button variant="outline" size="sm" onClick={() => revertAudit(detail)} className="gap-1">
                  <Undo2 className="w-4 h-4" /> Desfazer correção da IA
                </Button>
              )}
              {detail && (
                <Button variant="destructive" size="sm" onClick={() => deleteQuestao(detail)} className="gap-1">
                  <Trash2 className="w-4 h-4" /> Excluir questão
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {detail && (
                <Button variant="ghost" size="sm" onClick={() => dismissAudit(detail)} className="gap-1">
                  <X className="w-4 h-4" /> Manter como está
                </Button>
              )}
              {detail?.proposed_patch && (
                <Button variant="outline" size="sm" onClick={() => applyAISuggestion(detail)} className="gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Aplicar sugestão da IA
                </Button>
              )}
              <Button size="sm" onClick={saveManualEdit} disabled={saving || !form} className="gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar minhas alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
