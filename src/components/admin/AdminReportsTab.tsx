import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Trash2, Pencil } from "lucide-react";
import { QuestionEditDialog } from "./QuestionEditDialog";
import type { Questao } from "./AdminQuestoesTab";

export function AdminReportsTab() {
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Questao | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    setLoading(true);
    const { data } = await supabase.from("question_reports" as any).select("*").order("created_at", { ascending: false }).limit(100);
    setReports((data as any[]) || []);
    setLoading(false);
  };

  const resolveReport = async (reportId: number) => {
    await supabase.from("question_reports" as any).update({ status: "resolvido", resolved_at: new Date().toISOString() } as any).eq("id", reportId);
    loadReports();
    toast({ title: "Relatório marcado como resolvido" });
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
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
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
            <p className="text-sm">{r.motivo}</p>
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
