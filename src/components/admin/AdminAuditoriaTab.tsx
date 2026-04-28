import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play, Square, RefreshCw, AlertTriangle, CheckCircle2, Eye, Undo2 } from "lucide-react";

const DISCIPLINAS = [
  "Português",
  "Direito Constitucional",
  "Direito Administrativo",
  "Direito Penal Militar",
  "Legislação Institucional PMTO",
];

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

export function AdminAuditoriaTab() {
  const [selDisc, setSelDisc] = useState<string[]>([]);
  const [onlyUnaudited, setOnlyUnaudited] = useState(true);
  const [limit, setLimit] = useState(50);
  const [job, setJob] = useState<AuditJob | null>(null);
  const [running, setRunning] = useState(false);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("manual_review");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [questao, setQuestao] = useState<any>(null);
  const stopRef = useRef(false);

  async function loadAudits() {
    setLoading(true);
    let q = supabase.from("question_audits").select("*").order("created_at", { ascending: false }).limit(100);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setAudits((data ?? []) as AuditRow[]);
    setLoading(false);
  }

  useEffect(() => { loadAudits(); }, [filterStatus]);

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
      toast.success(`Auditoria iniciada (${j.total} questões)`);
      runLoop(j.id);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao iniciar");
      setRunning(false);
    }
  }

  async function runLoop(jobId: string) {
    while (!stopRef.current) {
      try {
        const { data, error } = await supabase.functions.invoke("audit-questions", {
          body: { action: "run", job_id: jobId },
        });
        if (error) throw error;
        const status = await supabase.functions.invoke("audit-questions", {
          body: { action: "status", job_id: jobId },
        });
        if (status.data?.job) setJob(status.data.job);
        if (data?.done) {
          toast.success("Auditoria concluída!");
          break;
        }
      } catch (e: any) {
        toast.error(`Lote falhou: ${e.message}`);
        break;
      }
    }
    setRunning(false);
    loadAudits();
  }

  async function cancel() {
    if (!job) return;
    stopRef.current = true;
    await supabase.functions.invoke("audit-questions", {
      body: { action: "cancel", job_id: job.id },
    });
    toast.info("Cancelando...");
  }

  async function approveAudit(a: AuditRow) {
    if (!a.proposed_patch) {
      await supabase.from("question_audits").update({ status: "approved" }).eq("id", a.id);
      toast.success("Marcada como aprovada");
      loadAudits();
      return;
    }
    // Snapshot
    const { data: q } = await supabase.from("questoes").select("*").eq("id", a.questao_id).single();
    if (q) {
      await supabase.from("question_versions").insert({
        questao_id: a.questao_id,
        snapshot: q,
        change_reason: "manual_apply_audit",
        audit_id: a.id,
      } as any);
    }
    await supabase.from("questoes").update(a.proposed_patch).eq("id", a.questao_id);
    await supabase.from("question_audits").update({
      status: "auto_fixed",
      applied_patch: a.proposed_patch,
    }).eq("id", a.id);
    toast.success("Correção aplicada");
    loadAudits();
  }

  async function rejectAudit(a: AuditRow) {
    await supabase.from("question_audits").update({ status: "rejected" }).eq("id", a.id);
    toast.success("Auditoria rejeitada");
    loadAudits();
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
    toast.success("Questão revertida ao snapshot");
    loadAudits();
  }

  async function openDetail(a: AuditRow) {
    setDetail(a);
    const { data } = await supabase.from("questoes").select("*").eq("id", a.questao_id).single();
    setQuestao(data);
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Auditoria Cética com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Disciplinas (vazio = todas):</p>
            <div className="flex flex-wrap gap-2">
              {DISCIPLINAS.map(d => (
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
              Apenas não auditadas
            </label>
            <label className="flex items-center gap-2 text-sm">
              Limite:
              <Input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} className="w-24" />
            </label>
          </div>
          <div className="flex gap-2">
            {!running ? (
              <Button onClick={startJob} className="gap-2">
                <Play className="w-4 h-4" />Iniciar auditoria
              </Button>
            ) : (
              <Button onClick={cancel} variant="destructive" className="gap-2">
                <Square className="w-4 h-4" />Cancelar
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
                <span className="text-green-500">✓ Auto-corrigidas: {job.auto_fixed}</span>
                <span className="text-yellow-500">⚠ Revisão manual: {job.flagged}</span>
                <span className="text-red-500">✗ Erros: {job.errors}</span>
              </div>
              {job.last_error && <p className="text-xs text-red-500">Último erro: {job.last_error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Resultados de auditoria</span>
            <Button size="sm" variant="ghost" onClick={loadAudits} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 flex-wrap">
            {["manual_review", "auto_fixed", "approved", "rejected", "error", "all"].map(s => (
              <Badge
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterStatus(s)}
              >{s}</Badge>
            ))}
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {audits.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma auditoria com este filtro.
                </p>
              )}
              {audits.map(a => (
                <div key={a.id} className="p-3 rounded-lg border border-border/40 bg-card/50 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={a.status === "auto_fixed" ? "default" : a.status === "manual_review" ? "destructive" : "outline"}>
                        {a.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Q#{a.questao_id}</span>
                      {a.confidence != null && (
                        <span className="text-xs text-muted-foreground">conf: {(a.confidence * 100).toFixed(0)}%</span>
                      )}
                      {a.risk_level && (
                        <span className="text-xs text-muted-foreground">risco: {a.risk_level}</span>
                      )}
                    </div>
                    <p className="text-sm truncate">{a.ai_summary ?? "(sem resumo)"}</p>
                    {a.issues?.length > 0 && (
                      <p className="text-xs text-yellow-500 mt-1">
                        {a.issues.length} issue(s): {a.issues.map((i: any) => i.type).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openDetail(a)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {a.status === "manual_review" && a.proposed_patch && (
                      <Button size="sm" variant="default" onClick={() => approveAudit(a)}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    {a.status === "manual_review" && (
                      <Button size="sm" variant="outline" onClick={() => rejectAudit(a)}>
                        Rejeitar
                      </Button>
                    )}
                    {a.status === "auto_fixed" && (
                      <Button size="sm" variant="outline" onClick={() => revertAudit(a)}>
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setQuestao(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auditoria Q#{detail?.questao_id}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div>
                <strong>Resumo IA:</strong>
                <p className="text-muted-foreground">{detail.ai_summary}</p>
              </div>
              <div>
                <strong>Issues:</strong>
                <pre className="text-xs bg-muted/30 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(detail.issues, null, 2)}
                </pre>
              </div>
              {detail.proposed_patch && (
                <div>
                  <strong>Correção proposta:</strong>
                  <pre className="text-xs bg-muted/30 p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(detail.proposed_patch, null, 2)}
                  </pre>
                </div>
              )}
              {questao && (
                <div>
                  <strong>Questão atual:</strong>
                  <div className="mt-1 p-2 bg-muted/30 rounded space-y-1 text-xs">
                    <p><b>Disciplina:</b> {questao.disciplina} / {questao.assunto}</p>
                    <p><b>Enunciado:</b> {questao.enunciado}</p>
                    {["a","b","c","d","e"].map(l => (
                      <p key={l}>
                        <b>{l.toUpperCase()})</b> {questao[`alt_${l}`]}
                        {questao.gabarito === ["a","b","c","d","e"].indexOf(l) && <span className="text-green-500 ml-2">✓</span>}
                      </p>
                    ))}
                    <p className="pt-1"><b>Comentário:</b> {questao.comentario}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
