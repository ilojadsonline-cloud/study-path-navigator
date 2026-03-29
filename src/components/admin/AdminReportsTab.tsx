import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, Trash2, Pencil, Send, User } from "lucide-react";
import { QuestionEditDialog } from "./QuestionEditDialog";
import type { Questao } from "./AdminQuestoesTab";

export function AdminReportsTab() {
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Questao | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [responseTexts, setResponseTexts] = useState<Record<number, string>>({});
  const [sendingResponse, setSendingResponse] = useState<number | null>(null);
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({});

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

  const resolveReport = async (reportId: number) => {
    await supabase.from("question_reports" as any).update({ status: "resolvido", resolved_at: new Date().toISOString() } as any).eq("id", reportId);
    loadReports();
    toast({ title: "Relatório marcado como resolvido" });
  };

  const sendResponse = async (reportId: number) => {
    const text = responseTexts[reportId]?.trim();
    if (!text) return;
    setSendingResponse(reportId);
    await supabase.from("question_reports" as any).update({ admin_notes: text, status: "resolvido", resolved_at: new Date().toISOString() } as any).eq("id", reportId);
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

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{reports.length} relatórios encontrados</p>
      {reports.map((r: any) => (
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
      ))}

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
