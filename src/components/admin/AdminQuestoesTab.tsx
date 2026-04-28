import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Trash2, Eye, Search, ChevronLeft, ChevronRight, Loader2, CheckCircle, Pencil, Save, ChevronsLeft, ChevronsRight, Hash,
} from "lucide-react";
import { QuestionViewDialog } from "./QuestionViewDialog";
import { QuestionEditDialog } from "./QuestionEditDialog";

export interface Questao {
  id: number; disciplina: string; assunto: string; dificuldade: string; enunciado: string;
  alt_a: string; alt_b: string; alt_c: string; alt_d: string; alt_e: string; gabarito: number; comentario: string;
}

const PAGE_SIZE = 20;

export function AdminQuestoesTab() {
  const { toast } = useToast();
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [disciplinaFilter, setDisciplinaFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [idSearch, setIdSearch] = useState("");
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [viewQuestion, setViewQuestion] = useState<Questao | null>(null);
  const [editQuestion, setEditQuestion] = useState<Questao | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [confirmDeleteQ, setConfirmDeleteQ] = useState<Questao | null>(null);
  const [goToPageInput, setGoToPageInput] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    loadDisciplinas();
    loadQuestoes(0);
  }, []);

  const loadDisciplinas = async () => {
    const { data } = await supabase.rpc("list_disciplinas");
    if (data) setDisciplinas((data as { disciplina: string }[]).map(d => d.disciplina));
  };

  const loadQuestoes = async (p = 0) => {
    setLoading(true);
    const from = p * PAGE_SIZE;
    let countQuery = supabase.from("questoes").select("*", { count: "exact", head: true });
    let query = supabase.from("questoes").select("*").order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (disciplinaFilter !== "todas") { countQuery = countQuery.eq("disciplina", disciplinaFilter); query = query.eq("disciplina", disciplinaFilter); }
    if (search) { countQuery = countQuery.ilike("enunciado", `%${search}%`); query = query.ilike("enunciado", `%${search}%`); }
    const [{ count }, { data }] = await Promise.all([countQuery, query]);
    setTotal(count || 0);
    setQuestoes((data as Questao[]) || []);
    setPage(p);
    setLoading(false);
  };

  const searchById = async () => {
    const id = parseInt(idSearch);
    if (isNaN(id)) return;
    setLoading(true);
    const { data } = await supabase.from("questoes").select("*").eq("id", id);
    if (data && data.length > 0) {
      setQuestoes(data as Questao[]);
      setTotal(1);
      setPage(0);
    } else {
      setQuestoes([]);
      setTotal(0);
      toast({ title: "Questão não encontrada", description: `ID #${id} não existe.`, variant: "destructive" });
    }
    setLoading(false);
  };

  const clearIdSearch = () => {
    setIdSearch("");
    loadQuestoes(0);
  };

  const deleteQuestion = async (id: number) => {
    await supabase.from("respostas_usuario").delete().eq("questao_id", id);
    const { error } = await supabase.from("questoes").delete().eq("id", id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Questão excluída" }); setConfirmDeleteQ(null); setViewQuestion(null); loadQuestoes(page); }
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
      loadQuestoes(page);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSavingQuestion(false);
  };

  // Called from Reports tab to open edit directly
  const openEditById = useCallback(async (id: number) => {
    const { data } = await supabase.from("questoes").select("*").eq("id", id).single();
    if (data) setEditQuestion(data as Questao);
  }, []);

  const gabaritoLabel = (g: number) => ["A", "B", "C", "D", "E"][g] || "?";

  const goToPage = () => {
    const p = parseInt(goToPageInput);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      loadQuestoes(p - 1);
      setGoToPageInput("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-wrap gap-3">
        {/* ID Search */}
        <div className="relative w-36">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ID..."
            value={idSearch}
            onChange={(e) => setIdSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchById()}
            className="pl-9"
            type="number"
          />
        </div>
        {idSearch && (
          <Button onClick={clearIdSearch} variant="ghost" size="sm" className="text-xs">Limpar ID</Button>
        )}

        <Select value={disciplinaFilter} onValueChange={setDisciplinaFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Disciplina" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as disciplinas</SelectItem>
            {disciplinas.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar no enunciado..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadQuestoes(0)} className="pl-9" />
        </div>
        <Button onClick={() => loadQuestoes(0)} variant="secondary" size="sm">Filtrar</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} questões encontradas</p>
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead><TableHead>Enunciado</TableHead>
                  <TableHead className="w-32">Disciplina</TableHead><TableHead className="w-20">Dif.</TableHead>
                  <TableHead className="w-16">Gab.</TableHead><TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questoes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma questão</TableCell></TableRow>
                ) : questoes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.id}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{q.enunciado}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{q.disciplina}</Badge></TableCell>
                    <TableCell className="text-xs">{q.dificuldade}</TableCell>
                    <TableCell className="font-bold text-primary">{gabaritoLabel(q.gabarito)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewQuestion(q)} title="Visualizar"><Eye className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditQuestion({ ...q })} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteQ(q)} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Full Pagination */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages} · {total} questões</p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => loadQuestoes(0)} title="Primeira página">
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => loadQuestoes(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Page number buttons */}
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 4) {
                  pageNum = totalPages - 7 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    size="sm"
                    variant={pageNum === page ? "default" : "outline"}
                    onClick={() => loadQuestoes(pageNum)}
                    className="w-8 h-8 p-0 text-xs"
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}

              <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => loadQuestoes(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => loadQuestoes(totalPages - 1)} title="Última página">
                <ChevronsRight className="w-4 h-4" />
              </Button>

              {/* Go to page */}
              <div className="flex items-center gap-1 ml-2">
                <Input
                  placeholder="Pág."
                  value={goToPageInput}
                  onChange={(e) => setGoToPageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goToPage()}
                  className="w-16 h-8 text-xs"
                  type="number"
                  min={1}
                  max={totalPages}
                />
                <Button size="sm" variant="outline" onClick={goToPage} className="h-8 text-xs">Ir</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* View Question Dialog */}
      <QuestionViewDialog
        question={viewQuestion}
        onClose={() => setViewQuestion(null)}
        onEdit={(q) => { setEditQuestion({ ...q }); setViewQuestion(null); }}
        onDelete={(q) => { setConfirmDeleteQ(q); setViewQuestion(null); }}
      />

      {/* Edit Question Dialog */}
      <QuestionEditDialog
        question={editQuestion}
        onClose={() => setEditQuestion(null)}
        onSave={handleSaveQuestion}
        saving={savingQuestion}
        onChange={setEditQuestion}
      />

      {/* Confirm Delete Question Dialog */}
      <Dialog open={!!confirmDeleteQ} onOpenChange={() => setConfirmDeleteQ(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir Questão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir a questão <strong>#{confirmDeleteQ?.id}</strong>? As respostas dos usuários também serão removidas.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteQ(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDeleteQ && deleteQuestion(confirmDeleteQ.id)}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
