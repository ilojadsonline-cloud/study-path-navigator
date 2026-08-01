import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Save, X, ChevronDown, ChevronRight, Ban, RotateCcw, CheckCircle2,
} from "lucide-react";

interface SimuladoRow {
  id: string;
  titulo: string;
  descricao: string | null;
  starts_at: string;
  ends_at: string;
  duracao_minutos: number;
  total_questoes: number;
  ativo: boolean;
  created_at: string;
}

interface QuestaoRow {
  id: string;
  simulado_id: string;
  ordem: number;
  disciplina: string;
  assunto: string | null;
  dificuldade: string;
  enunciado: string;
  alt_a: string; alt_b: string; alt_c: string; alt_d: string; alt_e: string;
  gabarito: number;
  comentario: string | null;
  anulada: boolean;
}

import { useCurso } from "@/contexts/CursoContext";
import { getQtdAlternativas } from "@/lib/edital-distribuicao";

const LETRAS = ["A", "B", "C", "D", "E"];
const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function SimuladoSemanalEditor({ simulado, onClose, onSaved }: {
  simulado: SimuladoRow; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { cursoSlug } = useCurso();
  const qtdAlternativas = getQtdAlternativas(cursoSlug);

  const [titulo, setTitulo] = useState(simulado.titulo);
  const [descricao, setDescricao] = useState(simulado.descricao ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(simulado.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(simulado.ends_at));
  const [duracao, setDuracao] = useState(simulado.duracao_minutos);
  const [savingMeta, setSavingMeta] = useState(false);

  const [questoes, setQuestoes] = useState<QuestaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [savingQ, setSavingQ] = useState<string | null>(null);
  const [annulling, setAnnulling] = useState<string | null>(null);

  const fetchQuestoes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("simulado_semanal_questoes")
      .select("*")
      .eq("simulado_id", simulado.id)
      .order("ordem", { ascending: true });
    setQuestoes((data as QuestaoRow[]) || []);
    setLoading(false);
  }, [simulado.id]);

  useEffect(() => { fetchQuestoes(); }, [fetchQuestoes]);

  const salvarMeta = async () => {
    if (titulo.trim().length < 3) {
      toast({ title: "Informe um título.", variant: "destructive" });
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      toast({ title: "O fim deve ser depois do início.", variant: "destructive" });
      return;
    }
    setSavingMeta(true);
    const { error } = await supabase
      .from("simulados_semanais")
      .update({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        duracao_minutos: Math.max(1, duracao),
      })
      .eq("id", simulado.id);
    setSavingMeta(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dados do simulado atualizados." });
    onSaved();
  };

  const patchQ = (id: string, patch: Partial<QuestaoRow>) =>
    setQuestoes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const salvarQuestao = async (q: QuestaoRow) => {
    setSavingQ(q.id);
    const { error } = await supabase
      .from("simulado_semanal_questoes")
      .update({
        disciplina: q.disciplina,
        assunto: q.assunto,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        alt_a: q.alt_a, alt_b: q.alt_b, alt_c: q.alt_c, alt_d: q.alt_d, alt_e: q.alt_e,
        gabarito: q.gabarito,
        comentario: q.comentario,
      })
      .eq("id", q.id);
    setSavingQ(null);
    if (error) {
      toast({ title: "Erro ao salvar questão", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Questão ${q.ordem} salva.` });
  };

  const toggleAnular = async (q: QuestaoRow) => {
    const anular = !q.anulada;
    if (anular && !confirm(`Anular a questão ${q.ordem}? Todos os alunos passarão a pontuar nela e as notas serão recalculadas.`)) return;
    setAnnulling(q.id);
    const { data, error } = await supabase.functions.invoke("simulado-semanal", {
      body: { action: anular ? "annul" : "unannul", simulado_id: simulado.id, questao_id: q.id },
    });
    setAnnulling(null);
    if (error || (data as any)?.error) {
      toast({ title: "Erro ao processar anulação", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    patchQ(q.id, { anulada: anular });
    toast({
      title: anular ? `Questão ${q.ordem} anulada.` : `Anulação da questão ${q.ordem} revertida.`,
      description: `${(data as any)?.recalculadas ?? 0} tentativa(s) recalculada(s).`,
    });
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-secondary/20 p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Editar simulado</h4>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* ── Dados cadastrais ── */}
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duração (minutos)</Label>
            <Input type="number" value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Abre em</Label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Encerra em</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <Button size="sm" onClick={salvarMeta} disabled={savingMeta} className="gradient-primary">
          {savingMeta ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar dados
        </Button>
      </div>

      {/* ── Questões ── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold">Questões ({questoes.length})</p>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          questoes.map((q) => {
            const isOpen = open === q.id;
            return (
              <div key={q.id} className={`rounded-lg border ${q.anulada ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/40"}`}>
                <button
                  className="w-full flex items-center gap-2 p-2.5 text-left"
                  onClick={() => setOpen(isOpen ? null : q.id)}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="text-xs font-bold w-8">{q.ordem}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{q.disciplina}</span>
                  <span className="text-xs flex-1 truncate">{q.enunciado.replace(/<[^>]+>/g, "").slice(0, 70)}</span>
                  {q.anulada && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">Anulada</span>}
                </button>

                {isOpen && (
                  <div className="p-3 pt-0 space-y-3 border-t border-border/40">
                    <div className="grid sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Disciplina</Label>
                        <Input value={q.disciplina} onChange={(e) => patchQ(q.id, { disciplina: e.target.value })} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Assunto</Label>
                        <Input value={q.assunto ?? ""} onChange={(e) => patchQ(q.id, { assunto: e.target.value })} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Dificuldade</Label>
                        <Input value={q.dificuldade} onChange={(e) => patchQ(q.id, { dificuldade: e.target.value })} className="h-8 text-xs" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Enunciado</Label>
                      <Textarea value={q.enunciado} onChange={(e) => patchQ(q.id, { enunciado: e.target.value })} className="min-h-[80px] text-xs" />
                    </div>

                    {ALT_KEYS.slice(0, qtdAlternativas).map((k, idx) => (
                      <div key={k} className="space-y-1">
                        <Label className="text-[11px] flex items-center gap-2">
                          <span translate="no">Alternativa {LETRAS[idx]}</span>
                          <button
                            type="button"
                            onClick={() => patchQ(q.id, { gabarito: idx })}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${q.gabarito === idx ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}
                          >
                            {q.gabarito === idx ? "✓ gabarito" : "marcar gabarito"}
                          </button>
                        </Label>
                        <Textarea value={q[k]} onChange={(e) => patchQ(q.id, { [k]: e.target.value } as Partial<QuestaoRow>)} className="min-h-[44px] text-xs" />
                      </div>
                    ))}

                    <div className="space-y-1">
                      <Label className="text-[11px]">Comentário do professor</Label>
                      <Textarea value={q.comentario ?? ""} onChange={(e) => patchQ(q.id, { comentario: e.target.value })} className="min-h-[80px] text-xs" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => salvarQuestao(q)} disabled={savingQ === q.id} className="gradient-primary">
                        {savingQ === q.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar questão
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleAnular(q)}
                        disabled={annulling === q.id}
                        className={q.anulada ? "text-success" : "text-destructive"}
                      >
                        {annulling === q.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          : q.anulada ? <RotateCcw className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                        {q.anulada ? "Reverter anulação" : "Anular (todos pontuam)"}
                      </Button>
                      {q.anulada && (
                        <span className="text-[11px] text-primary flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ponto concedido a todos os alunos
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
