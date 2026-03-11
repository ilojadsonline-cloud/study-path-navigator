import { useState, useEffect } from "react";
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
  Trash2, Eye, Search, ChevronLeft, ChevronRight, Loader2, CheckCircle, Pencil, Save,
} from "lucide-react";

interface Questao {
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
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [viewQuestion, setViewQuestion] = useState<Questao | null>(null);
  const [editQuestion, setEditQuestion] = useState<Questao | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [confirmDeleteQ, setConfirmDeleteQ] = useState<Questao | null>(null);

  useEffect(() => {
    loadDisciplinas();
    loadQuestoes(0);
  }, []);

  const loadDisciplinas = async () => {
    const { data } = await supabase.from("questoes").select("disciplina");
    if (data) setDisciplinas([...new Set(data.map(d => d.disciplina))].sort());
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

  const gabaritoLabel = (g: number) => ["A", "B", "C", "D", "E"][g] || "?";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => loadQuestoes(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => loadQuestoes(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </>
      )}

      {/* View Question Dialog */}
      <Dialog open={!!viewQuestion} onOpenChange={() => setViewQuestion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewQuestion && (
            <>
              <DialogHeader><DialogTitle className="text-sm font-mono text-muted-foreground">Questão #{viewQuestion.id}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{viewQuestion.disciplina} · {viewQuestion.assunto} · {viewQuestion.dificuldade}</p>
                  <p className="text-sm">{viewQuestion.enunciado}</p>
                </div>
                <div className="space-y-2">
                  {[viewQuestion.alt_a, viewQuestion.alt_b, viewQuestion.alt_c, viewQuestion.alt_d, viewQuestion.alt_e].map((alt, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${i === viewQuestion.gabarito ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
                      <span className="font-bold text-xs mt-0.5" translate="no">{["A", "B", "C", "D", "E"][i]})</span>
                      <span>{alt}</span>
                      {i === viewQuestion.gabarito && <CheckCircle className="w-4 h-4 text-primary shrink-0 ml-auto" />}
                    </div>
                  ))}
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário:</p>
                  <p className="text-sm">{viewQuestion.comentario}</p>
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditQuestion({ ...viewQuestion }); setViewQuestion(null); }}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { setConfirmDeleteQ(viewQuestion); setViewQuestion(null); }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={!!editQuestion} onOpenChange={() => setEditQuestion(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {editQuestion && (
            <>
              <DialogHeader><DialogTitle>Editar Questão #{editQuestion.id}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Disciplina</label>
                    <Input value={editQuestion.disciplina} onChange={(e) => setEditQuestion({ ...editQuestion, disciplina: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Assunto</label>
                    <Input value={editQuestion.assunto} onChange={(e) => setEditQuestion({ ...editQuestion, assunto: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Dificuldade</label>
                    <Select value={editQuestion.dificuldade} onValueChange={(v) => setEditQuestion({ ...editQuestion, dificuldade: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fácil">Fácil</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                        <SelectItem value="Difícil">Difícil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Enunciado</label>
                  <Textarea value={editQuestion.enunciado} onChange={(e) => setEditQuestion({ ...editQuestion, enunciado: e.target.value })} rows={3} />
                </div>
                {(["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const).map((key, i) => (
                  <div key={key} className="flex items-start gap-2">
                    <div className="flex items-center gap-1 mt-2">
                      <input type="radio" name="gabarito" checked={editQuestion.gabarito === i}
                        onChange={() => setEditQuestion({ ...editQuestion, gabarito: i })} className="accent-primary" />
                      <span className="text-xs font-bold">{["A", "B", "C", "D", "E"][i]}</span>
                    </div>
                    <Textarea value={editQuestion[key]} onChange={(e) => setEditQuestion({ ...editQuestion, [key]: e.target.value })} rows={1} className="flex-1" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-muted-foreground">Comentário</label>
                  <Textarea value={editQuestion.comentario} onChange={(e) => setEditQuestion({ ...editQuestion, comentario: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditQuestion(null)}>Cancelar</Button>
                <Button onClick={handleSaveQuestion} disabled={savingQuestion} className="gradient-primary text-primary-foreground font-bold">
                  {savingQuestion ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {savingQuestion ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
