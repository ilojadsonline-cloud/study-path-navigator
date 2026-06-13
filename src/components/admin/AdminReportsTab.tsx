import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, Trash2, Pencil, Send, User, Sparkles, Wand2, ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react";
import { QuestionEditDialog } from "./QuestionEditDialog";
import type { Questao } from "./AdminQuestoesTab";

const FIELD_LABELS: Record<string, string> = {
  enunciado: "Enunciado",
  alt_a: "Alternativa A",
  alt_b: "Alternativa B",
  alt_c: "Alternativa C",
  alt_d: "Alternativa D",
  alt_e: "Alternativa E",
  gabarito: "Gabarito",
  comentario: "Comentário",
};

type AiResult = {
  procedente: boolean;
  needs_human_review: boolean;
  confianca: number;
  justificativa: string;
  resposta_usuario: string;
  proposed_patch: Record<string, any> | null;
  applied?: boolean;
};

export function AdminReportsTab() {
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Questao | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [responseTexts, setResponseTexts] = useState<Record<number, string>>({});
  const [sendingResponse, setSendingResponse] = useState<number | null>(null);
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({});
  const [aiResults, setAiResults] = useState<Record<number, AiResult>>({});
  const [aiLoading, setAiLoading] = useState<number | null>(null);
  const [applyingPatch, setApplyingPatch] = useState<number | null>(null);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    setLoading(true);
    const { data } = await supabase.from("question_reports" as any).select("*").order("created_at", { ascending: false }).limit(100);
    const reports = (data as any[]) || [];
    setReports(reports);

    // Fetch reporter names
    const userIds = [...new Set(reports.map((r: any) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome, email").in("user_id", userIds);
      if (profiles) {
        const names: Record<string, string> = {};
        profiles.forEach((p) => { names[p.user_id] = p.nome || p.email || "Usuário"; });
        setReporterNames(names);
      }
    }

    // Pre-fill existing admin_notes
    const texts: Record<number, string> = {};
    reports.forEach((r: any) => { if (r.admin_notes) texts[r.id] = r.admin_notes; });
    setResponseTexts(texts);

    setLoading(false);
  };

  const analyzeWithAI = async (reportId: number) => {
    setAiLoading(reportId);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-report-ai", {
        body: { report_id: reportId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data as AiResult;
      setAiResults((prev) => ({ ...prev, [reportId]: result }));
      // Pré-preenche a resposta ao usuário com a mensagem redigida pela IA.
      if (result.resposta_usuario) {
        setResponseTexts((prev) => ({ ...prev, [reportId]: result.resposta_usuario }));
      }
      toast({
        title: result.procedente ? "Reporte considerado procedente" : "Reporte considerado improcedente",
        description: result.needs_human_review ? "A IA recomenda revisão manual." : "Revise a sugestão antes de aplicar.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao analisar com IA", description: err.message, variant: "destructive" });
    }
    setAiLoading(null);
  };

  const applyAiPatch = async (report: any) => {
    const result = aiResults[report.id];
    if (!result?.proposed_patch) return;
    setApplyingPatch(report.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "update_question",
          question_id: report.questao_id,
          updates: result.proposed_patch,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiResults((prev) => ({ ...prev, [report.id]: { ...result, applied: true } }));
      toast({ title: "Correção aplicada à questão!" });
    } catch (err: any) {
      toast({ title: "Erro ao aplicar correção", description: err.message, variant: "destructive" });
    }
    setApplyingPatch(null);
  };

  const resolveReport = async (reportId: number) => {
    await supabase.from("question_reports" as any).update({ status: "resolvido", resolved_at: new Date().toISOString() } as any).eq("id", reportId);
    loadReports();
    toast({ title: "Relatório marcado como resolvido" });
  };

  const sendResponse = async (reportId: number) => {
    const text = responseTexts[reportId]?.trim();
    if (!text) return;
    const report = reports.find((r) => r.id === reportId);
    setSendingResponse(reportId);
    await supabase.from("question_reports" as any).update({ admin_notes: text, status: "resolvido", resolved_at: new Date().toISOString() } as any).eq("id", reportId);
    // Notifica o usuário que reportou (alerta no sino + alerta flutuante via realtime)
    if (report?.user_id) {
      await supabase.from("notifications" as any).insert({
        title: `Resposta ao seu reporte (Questão #${report.questao_id})`,
        message: text,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        user_id: report.user_id,
      } as any);
    }
    setSendingResponse(null);
    loadReports();
    toast({ title: "Resposta enviada ao usuário" });
  };

  const deleteReport = async (reportId: number) => {
    await supabase.from("question_reports" as any).delete().eq("id", reportId);
    loadReports();
  };

  const openEditQuestion = async (questaoId: number) => {
    const { data } = await supabase.from("questoes").select("*").eq("id", questaoId).single();
    if (data) {
      setEditQuestion(data as Questao);
    } else {
      toast({ title: "Questão não encontrada", description: `ID #${questaoId} pode ter sido excluída.`, variant: "destructive" });
    }
  };

  const handleSaveQuestion = async () => {
    if (!editQuestion) return;
    setSavingQuestion(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "update_question",
          question_id: editQuestion.id,
          updates: {
            enunciado: editQuestion.enunciado,
            alt_a: editQuestion.alt_a, alt_b: editQuestion.alt_b, alt_c: editQuestion.alt_c,
            alt_d: editQuestion.alt_d, alt_e: editQuestion.alt_e,
            gabarito: editQuestion.gabarito, comentario: editQuestion.comentario,
            disciplina: editQuestion.disciplina, assunto: editQuestion.assunto, dificuldade: editQuestion.dificuldade,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Questão atualizada!" });
      setEditQuestion(null);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSavingQuestion(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (reports.length === 0) return <p className="text-muted-foreground text-center py-12">Nenhum relatório de erro pendente.</p>;

  const renderPatchValue = (field: string, value: any) => {
    if (field === "gabarito") return ["A", "B", "C", "D", "E"][Number(value)] ?? String(value);
    return String(value);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{reports.length} relatórios encontrados</p>
      {reports.map((r: any) => {
        const ai = aiResults[r.id];
        return (
        <Card key={r.id} className="glass-card border-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={r.status === "resolvido" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>
                  {r.status}
                </Badge>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs p-0 h-auto text-primary underline"
                  onClick={() => openEditQuestion(r.questao_id)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Questão #{r.questao_id} — Editar
                </Button>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex gap-1">
                {r.status !== "resolvido" && (
                  <Button size="sm" variant="outline" onClick={() => resolveReport(r.id)} className="text-xs h-7">
                    <CheckCircle className="w-3 h-3 mr-1" />Resolver
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => deleteReport(r.id)} className="text-xs h-7 text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Reporter info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
              <User className="w-3.5 h-3.5" />
              <span>Reportado por: <strong className="text-foreground">{reporterNames[r.user_id] || "Carregando..."}</strong></span>
            </div>

            <p className="text-sm">{r.motivo}</p>

            {/* AI assistant */}
            <div className="border-t border-border/30 pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => analyzeWithAI(r.id)}
                disabled={aiLoading === r.id}
                className="text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
              >
                {aiLoading === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {ai ? "Analisar novamente com IA" : "Analisar e corrigir com IA"}
              </Button>

              {ai && (
                <div className="mt-3 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={ai.procedente ? "bg-warning/10 text-warning border-warning/30" : "bg-success/10 text-success border-success/30"}>
                      {ai.procedente ? <ThumbsUp className="w-3 h-3 mr-1" /> : <ThumbsDown className="w-3 h-3 mr-1" />}
                      {ai.procedente ? "Reporte procedente" : "Reporte improcedente"}
                    </Badge>
                    {ai.needs_human_review && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                        <AlertTriangle className="w-3 h-3 mr-1" />Revisar manualmente
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">Confiança: {Math.round((ai.confianca || 0) * 100)}%</span>
                  </div>

                  {ai.justificativa && <p className="text-xs text-muted-foreground"><strong className="text-foreground">Análise:</strong> {ai.justificativa}</p>}

                  {/* Proposed correction */}
                  {ai.proposed_patch && Object.keys(ai.proposed_patch).length > 0 && (
                    <div className="space-y-2 rounded-md bg-background/50 p-2">
                      <p className="text-xs font-semibold text-muted-foreground">Correção sugerida:</p>
                      <ul className="space-y-1">
                        {Object.entries(ai.proposed_patch).map(([field, value]) => (
                          <li key={field} className="text-xs">
                            <span className="font-medium text-primary">{FIELD_LABELS[field] || field}:</span>{" "}
                            <span className="text-foreground">{renderPatchValue(field, value)}</span>
                          </li>
                        ))}
                      </ul>
                      {ai.applied ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />Correção aplicada
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => applyAiPatch(r)}
                          disabled={applyingPatch === r.id}
                          className="text-xs gap-1"
                        >
                          {applyingPatch === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Aplicar correção na questão
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin response field */}
            <div className="space-y-2 border-t border-border/30 pt-3">
              <label className="text-xs font-medium text-muted-foreground">Resposta ao usuário:</label>
              <Textarea
                placeholder="Escreva sua resposta sobre a correção..."
                value={responseTexts[r.id] || ""}
                onChange={(e) => setResponseTexts(prev => ({ ...prev, [r.id]: e.target.value }))}
                className="text-sm min-h-[60px]"
              />
              <Button
                size="sm"
                onClick={() => sendResponse(r.id)}
                disabled={!responseTexts[r.id]?.trim() || sendingResponse === r.id}
                className="text-xs"
              >
                {sendingResponse === r.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                Enviar resposta
              </Button>
            </div>
          </CardContent>
        </Card>
        );
      })}

      <QuestionEditDialog
        question={editQuestion}
        onClose={() => setEditQuestion(null)}
        onSave={handleSaveQuestion}
        saving={savingQuestion}
        onChange={setEditQuestion}
      />
    </div>
  );
}
