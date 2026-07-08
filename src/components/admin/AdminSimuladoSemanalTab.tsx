import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarClock, Loader2, Upload, Trophy, Trash2, CheckCircle2, AlertTriangle,
  Power, PowerOff, Plus, Users, Pencil, Eye, EyeOff,
} from "lucide-react";
import { parseMarkdownQuestoes } from "@/lib/markdown-questoes-parser";
import { SimuladoSemanalEditor } from "@/components/admin/SimuladoSemanalEditor";
import {
  EDITAL_DISTRIBUICAO, DURACAO_PADRAO_MINUTOS, VALOR_QUESTAO,
  TOTAL_QUESTOES_SIMULADO, situacaoLabel,
} from "@/lib/edital-distribuicao";

interface SimuladoRow {
  id: string;
  titulo: string;
  descricao: string | null;
  starts_at: string;
  ends_at: string;
  duracao_minutos: number;
  total_questoes: number;
  ativo: boolean;
  revisao_liberada: boolean;
  created_at: string;
}

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function AdminSimuladoSemanalTab() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [duracao, setDuracao] = useState(DURACAO_PADRAO_MINUTOS);
  const [markdown, setMarkdown] = useState("");
  const [saving, setSaving] = useState(false);

  const [lista, setLista] = useState<SimuladoRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [rankingOpen, setRankingOpen] = useState<string | null>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);


  const fetchLista = useCallback(async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("simulados_semanais")
      .select("*")
      .order("created_at", { ascending: false });
    setLista((data as SimuladoRow[]) || []);
    setLoadingList(false);
  }, []);

  useEffect(() => { fetchLista(); }, [fetchLista]);

  const analise = useMemo(() => (markdown.trim() ? parseMarkdownQuestoes(markdown) : null), [markdown]);

  // Distribuição encontrada x exigida
  const distribInfo = useMemo(() => {
    if (!analise) return null;
    const contagem: Record<string, number> = {};
    analise.validas.forEach((q) => { contagem[q.disciplina] = (contagem[q.disciplina] || 0) + 1; });
    const linhas = EDITAL_DISTRIBUICAO.map((d) => ({
      nome: d.nome,
      exigido: d.questoes,
      atual: contagem[d.nome] || 0,
      ok: (contagem[d.nome] || 0) === d.questoes,
    }));
    const extras = Object.keys(contagem).filter((k) => !EDITAL_DISTRIBUICAO.some((d) => d.nome === k));
    const tudoOk = linhas.every((l) => l.ok) && extras.length === 0 && analise.validas.length === TOTAL_QUESTOES_SIMULADO;
    return { linhas, extras, tudoOk };
  }, [analise]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMarkdown(await file.text());
    e.target.value = "";
  };

  const criar = async () => {
    if (titulo.trim().length < 3) {
      toast({ title: "Informe um título.", variant: "destructive" });
      return;
    }
    const result = parseMarkdownQuestoes(markdown);
    if (!distribInfo?.tudoOk) {
      toast({
        title: "Distribuição inválida",
        description: `O simulado deve ter exatamente ${TOTAL_QUESTOES_SIMULADO} questões na distribuição do edital.`,
        variant: "destructive",
      });
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      toast({ title: "O fim deve ser depois do início.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: sim, error } = await supabase
      .from("simulados_semanais")
      .insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        duracao_minutos: duracao,
        valor_questao: VALOR_QUESTAO,
        total_questoes: TOTAL_QUESTOES_SIMULADO,
        ativo: true,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();

    if (error || !sim) {
      setSaving(false);
      toast({ title: "Erro ao criar simulado", description: error?.message, variant: "destructive" });
      return;
    }

    const rows = result.validas.map((q, i) => ({
      simulado_id: sim.id,
      ordem: i + 1,
      disciplina: q.disciplina,
      assunto: q.assunto,
      dificuldade: q.dificuldade,
      enunciado: q.enunciado,
      alt_a: q.alternativas[0],
      alt_b: q.alternativas[1],
      alt_c: q.alternativas[2],
      alt_d: q.alternativas[3],
      alt_e: q.alternativas[4],
      gabarito: q.gabarito,
      comentario: q.comentario,
    }));
    const { error: qErr } = await supabase.from("simulado_semanal_questoes").insert(rows as any);
    setSaving(false);
    if (qErr) {
      await supabase.from("simulados_semanais").delete().eq("id", sim.id);
      toast({ title: "Erro ao salvar questões", description: qErr.message, variant: "destructive" });
      return;
    }

    toast({ title: "Simulado semanal publicado!", description: `${rows.length} questões.` });
    setTitulo(""); setDescricao(""); setMarkdown("");
    fetchLista();
  };

  const toggleAtivo = async (s: SimuladoRow) => {
    await supabase.from("simulados_semanais").update({ ativo: !s.ativo }).eq("id", s.id);
    fetchLista();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este simulado e todas as tentativas? Esta ação não pode ser desfeita.")) return;
    await supabase.from("simulados_semanais").delete().eq("id", id);
    fetchLista();
  };

  const verRanking = async (id: string) => {
    if (rankingOpen === id) { setRankingOpen(null); return; }
    setRankingOpen(id);
    setLoadingRanking(true);
    const { data } = await supabase.rpc("get_simulado_semanal_ranking", { p_simulado_id: id });
    setRanking((data as any[]) || []);
    setLoadingRanking(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" /> Simulado Semanal
        </h2>
        <p className="text-sm text-muted-foreground">
          Publique a prova da semana (50 questões, {DURACAO_PADRAO_MINUTOS / 60}h, 1 tentativa por aluno) seguindo a distribuição do edital.
        </p>
      </div>

      {/* ── Criação ── */}
      <div className="glass-card rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Novo simulado</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Simulado Semanal #1 — CHOA 2026" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duração (minutos)</Label>
            <Input type="number" value={duracao} onChange={(e) => setDuracao(Math.max(1, Number(e.target.value) || DURACAO_PADRAO_MINUTOS))} />
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
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Instruções rápidas mostradas ao aluno" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Questões em Markdown (blocos separados por ---)</Label>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium cursor-pointer hover:bg-secondary/70">
              <Upload className="w-3.5 h-3.5" /> Arquivo .md
              <input type="file" accept=".md,.markdown,.txt" className="hidden" onChange={handleFile} />
            </label>
          </div>
          <Textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} placeholder="Cole as 50 questões…" className="min-h-[200px] font-mono text-xs" />
        </div>

        {/* Validação da distribuição */}
        {analise && (
          <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              Distribuição (válidas: {analise.validas.length}/{TOTAL_QUESTOES_SIMULADO})
              {distribInfo?.tudoOk ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {distribInfo?.linhas.map((l) => (
                <span key={l.nome} className={`text-[11px] px-2 py-1 rounded ${l.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                  {l.nome}: {l.atual}/{l.exigido}
                </span>
              ))}
            </div>
            {distribInfo && distribInfo.extras.length > 0 && (
              <p className="text-[11px] text-destructive">Disciplinas fora do edital: {distribInfo.extras.join(", ")}</p>
            )}
            {analise.ignoradas.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 pt-1">
                {analise.ignoradas.map((ig) => (
                  <p key={ig.bloco} className="text-[11px] text-muted-foreground">
                    <span className="text-warning font-semibold">Bloco {ig.bloco}:</span> {ig.motivo}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <Button onClick={criar} disabled={saving || !distribInfo?.tudoOk} className="gradient-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarClock className="w-4 h-4 mr-2" />}
          Publicar simulado semanal
        </Button>
      </div>

      {/* ── Lista ── */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Simulados publicados</h3>
        {loadingList ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum simulado semanal publicado ainda.</p>
        ) : (
          lista.map((s) => (
            <div key={s.id} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{s.titulo}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {s.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.starts_at).toLocaleString("pt-BR")} → {new Date(s.ends_at).toLocaleString("pt-BR")} • {s.duracao_minutos} min • {s.total_questoes} questões
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(editOpen === s.id ? null : s.id)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleAtivo(s)}>
                    {s.ativo ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => verRanking(s.id)}>
                    <Trophy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => excluir(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {editOpen === s.id && (
                <SimuladoSemanalEditor
                  simulado={s}
                  onClose={() => setEditOpen(null)}
                  onSaved={fetchLista}
                />
              )}

              {rankingOpen === s.id && (
                <div className="rounded-lg bg-secondary/40 p-3">
                  {loadingRanking ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                  ) : ranking.length === 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Nenhuma tentativa finalizada.</p>
                  ) : (
                    <div className="space-y-1">
                      {ranking.map((r) => (
                        <div key={r.user_id} className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                          <span className="w-8 font-bold">{r.posicao}º</span>
                          <span className="flex-1 truncate">{r.nome}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.situacao === "classificado" ? "bg-success/15 text-success" : r.situacao === "aprovado_nao_classificado" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
                            {situacaoLabel(r.situacao)}
                          </span>
                          <span className="font-bold w-16 text-right">{Number(r.pontuacao).toFixed(1)} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
