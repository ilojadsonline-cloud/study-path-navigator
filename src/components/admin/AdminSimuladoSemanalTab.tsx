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
  Power, PowerOff, Plus, Users, Pencil, Eye, EyeOff, RotateCw, Gavel,
  ThumbsUp, ThumbsDown, MessageSquare, Sparkles,
} from "lucide-react";
import { parseMarkdownQuestoes } from "@/lib/markdown-questoes-parser";
import { SimuladoSemanalEditor } from "@/components/admin/SimuladoSemanalEditor";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";

import {
  getDistribuicao, getDuracaoMinutos, getEditalConfig,
  getTotalQuestoes, situacaoLabel,
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
  const { cursoId, cursoSlug } = useCurso();
  const { toast } = useToast();
  const editalCfg = getEditalConfig(cursoSlug);
  const EDITAL_DISTRIBUICAO = editalCfg.distribuicao;
  const TOTAL_QUESTOES_SIMULADO = getTotalQuestoes(cursoSlug);
  const VALOR_QUESTAO = editalCfg.valorQuestao;
  const DURACAO_PADRAO_MINUTOS = getDuracaoMinutos(cursoSlug);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [duracao, setDuracao] = useState(getDuracaoMinutos(cursoSlug));
  const [markdown, setMarkdown] = useState("");
  const [saving, setSaving] = useState(false);

  const [lista, setLista] = useState<SimuladoRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [rankingOpen, setRankingOpen] = useState<string | null>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [reopenFor, setReopenFor] = useState<string | null>(null);
  const [reopenDate, setReopenDate] = useState("");
  const [recursosOpen, setRecursosOpen] = useState<string | null>(null);
  const [recursos, setRecursos] = useState<any[]>([]);
  const [loadingRecursos, setLoadingRecursos] = useState(false);



  const fetchLista = useCallback(async () => {
    setLoadingList(true);
    let query = supabase
      .from("simulados_semanais")
      .select("*")
      .order("created_at", { ascending: false });
    const filter = cursoOrFilter(cursoId, cursoSlug);
    if (filter) query = query.or(filter);
    const { data } = await query;
    setLista((data as SimuladoRow[]) || []);
    setLoadingList(false);
  }, [cursoId]);

  useEffect(() => { fetchLista(); }, [fetchLista]);
  useEffect(() => { setDuracao(getDuracaoMinutos(cursoSlug)); }, [cursoSlug]);

  const analise = useMemo(() => (markdown.trim() ? parseMarkdownQuestoes(markdown, cursoSlug) : null), [markdown, cursoSlug]);

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
  }, [analise, cursoSlug]);

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
    const result = parseMarkdownQuestoes(markdown, cursoSlug);
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
        curso_id: cursoId,
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

  const toggleRevisao = async (s: SimuladoRow) => {
    const { error } = await supabase
      .from("simulados_semanais")
      .update({ revisao_liberada: !s.revisao_liberada })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Erro ao alterar revisão", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: !s.revisao_liberada ? "Revisão liberada para os alunos." : "Revisão ocultada dos alunos.",
    });
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

  const abrirReopen = (s: SimuladoRow) => {
    if (reopenFor === s.id) { setReopenFor(null); return; }
    setReopenFor(s.id);
    const base = new Date(Math.max(Date.now(), new Date(s.ends_at).getTime()));
    base.setDate(base.getDate() + 7);
    setReopenDate(toLocalInput(base));
  };

  const confirmarReopen = async (id: string) => {
    if (!reopenDate) return;
    const { data, error } = await supabase.functions.invoke("simulado-semanal", {
      body: { action: "reopen", simulado_id: id, ends_at: new Date(reopenDate).toISOString() },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Erro ao reabrir", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Simulado reaberto.", description: "Alunos que ainda não responderam poderão participar." });
    setReopenFor(null);
    fetchLista();
  };

  const verRecursos = async (id: string) => {
    if (recursosOpen === id) { setRecursosOpen(null); return; }
    setRecursosOpen(id);
    setLoadingRecursos(true);
    const { data, error } = await supabase
      .from("simulado_semanal_recursos")
      .select("id, argumento, status, decisao_admin, created_at, user_id, questao_id, simulado_semanal_questoes(ordem, disciplina, enunciado)")
      .eq("simulado_id", id)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar recursos", description: error.message, variant: "destructive" });
    let list: any[] = (data as any[]) || [];
    if (list.length) {
      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      const map = new Map((profs as any[] || []).map((p) => [p.user_id, p.nome]));
      list = list.map((r) => ({ ...r, _nome: map.get(r.user_id) || "Aluno" }));
    }
    setRecursos(list);
    setLoadingRecursos(false);
  };


  const decidirRecurso = async (r: any, decisao: "procedente" | "improcedente", justificativa: string, simuladoId: string) => {
    if (!justificativa.trim()) {
      toast({ title: "Escreva a justificativa da decisão.", variant: "destructive" });
      return;
    }
    const statusAnterior = r.status;
    const { error } = await supabase
      .from("simulado_semanal_recursos")
      .update({ status: decisao, decisao_admin: justificativa.trim(), decidido_em: new Date().toISOString(), decidido_por: user?.id ?? null })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Erro ao decidir", description: error.message, variant: "destructive" });
      return;
    }
    // Mudou para deferido → anula. Antes era deferido e agora não é mais → desanula.
    if (decisao === "procedente" && statusAnterior !== "procedente") {
      await supabase.functions.invoke("simulado-semanal", {
        body: { action: "annul", simulado_id: simuladoId, questao_id: r.questao_id },
      });
    } else if (statusAnterior === "procedente" && decisao !== "procedente") {
      await supabase.functions.invoke("simulado-semanal", {
        body: { action: "unannul", simulado_id: simuladoId, questao_id: r.questao_id },
      });
    }
    toast({ title: decisao === "procedente" ? "Recurso deferido — questão anulada." : "Recurso indeferido." });
    verRecursos(simuladoId);
  };

  const reabrirRecurso = async (r: any, simuladoId: string) => {
    const eraProcedente = r.status === "procedente";
    const { error } = await supabase
      .from("simulado_semanal_recursos")
      .update({ status: "pendente", decidido_em: null, decidido_por: null })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Erro ao reabrir recurso", description: error.message, variant: "destructive" });
      return;
    }
    if (eraProcedente) {
      await supabase.functions.invoke("simulado-semanal", {
        body: { action: "unannul", simulado_id: simuladoId, questao_id: r.questao_id },
      });
    }
    toast({ title: "Recurso reaberto para reanálise." });
    verRecursos(simuladoId);
  };



  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" /> Simulado Semanal
        </h2>
        <p className="text-sm text-muted-foreground">
          Publique a prova da semana ({TOTAL_QUESTOES_SIMULADO} questões, {duracao / 60}h, 1 tentativa por aluno) seguindo a distribuição do edital.
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{s.titulo}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {s.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${s.revisao_liberada ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {s.revisao_liberada ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {s.revisao_liberada ? "Revisão liberada" : "Revisão oculta"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.starts_at).toLocaleString("pt-BR")} → {new Date(s.ends_at).toLocaleString("pt-BR")} • {s.duracao_minutos} min • {s.total_questoes} questões
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(editOpen === s.id ? null : s.id)} title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleRevisao(s)}
                    title={s.revisao_liberada ? "Ocultar revisão dos alunos" : "Liberar revisão para os alunos"}
                    className={s.revisao_liberada ? "text-primary" : ""}
                  >
                    {s.revisao_liberada ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleAtivo(s)} title={s.ativo ? "Desativar" : "Ativar"}>
                    {s.ativo ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirReopen(s)} title="Reabrir (estender prazo)">
                    <RotateCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => verRanking(s.id)} title="Ranking">
                    <Trophy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => verRecursos(s.id)} title="Recursos">
                    <Gavel className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => excluir(s.id)} title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {reopenFor === s.id && (
                <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><RotateCw className="w-3.5 h-3.5 text-primary" /> Reabrir simulado</p>
                  <p className="text-[11px] text-muted-foreground">Estender o encerramento para permitir que quem ainda não respondeu participe. Quem já tentou não poderá refazer.</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Novo encerramento</Label>
                      <Input type="datetime-local" value={reopenDate} onChange={(e) => setReopenDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <Button size="sm" onClick={() => confirmarReopen(s.id)} className="gradient-primary">
                      Reabrir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReopenFor(null)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {recursosOpen === s.id && (
                <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Gavel className="w-3.5 h-3.5 text-primary" /> Recursos dos alunos</p>
                  {loadingRecursos ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                  ) : recursos.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Nenhum recurso registrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {recursos.map((r) => (
                        <RecursoItem
                          key={r.id}
                          recurso={r}
                          onDecidir={(dec, just) => decidirRecurso(r, dec, just, s.id)}
                          onReabrir={() => reabrirRecurso(r, s.id)}
                          toast={toast}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}


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

function RecursoItem({ recurso, onDecidir, onReabrir, toast }: {
  recurso: any;
  onDecidir: (decisao: "procedente" | "improcedente", justificativa: string) => void | Promise<void>;
  onReabrir: () => void | Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [just, setJust] = useState(recurso.decisao_admin ?? "");
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [aiResult, setAiResult] = useState<{ procedente: boolean; needs_human_review: boolean; confianca: number; justificativa: string; provider: string } | null>(null);
  const q = recurso.simulado_semanal_questoes;
  const decidido = recurso.status !== "pendente";
  const emEdicao = !decidido || editando;
  const badge = recurso.status === "procedente"
    ? "bg-success/15 text-success"
    : recurso.status === "improcedente"
      ? "bg-destructive/15 text-destructive"
      : "bg-warning/15 text-warning";

  const analisarComIA = async () => {
    setAnalisando(true);
    setAiResult(null);
    const { data, error } = await supabase.functions.invoke("resolve-recurso-ai", {
      body: { recurso_id: recurso.id },
    });
    setAnalisando(false);
    if (error || (data as any)?.error) {
      toast({ title: "Erro na análise por IA", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    setAiResult(data as any);
    setJust((data as any).justificativa || "");
    setEditando(true);
    setOpen(true);
  };
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-2.5 space-y-2">
      <button className="w-full text-left flex items-center gap-2" onClick={() => setOpen((v) => !v)}>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge}`}>{recurso.status}</span>
        <span className="text-[11px] font-semibold">Q{q?.ordem ?? "?"} · {q?.disciplina ?? ""}</span>
        <span className="text-[11px] flex-1 truncate">{recurso._nome}</span>
        <span className="text-[10px] text-muted-foreground">{new Date(recurso.created_at).toLocaleDateString("pt-BR")}</span>
      </button>
      {open && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <div className="text-[11px]"><strong>Aluno:</strong> {recurso._nome}</div>
          <div className="text-[11px] whitespace-pre-wrap"><strong>Argumento:</strong> {recurso.argumento}</div>
          {q?.enunciado && (
            <div className="text-[11px] text-muted-foreground max-h-24 overflow-y-auto"><strong>Enunciado:</strong> {q.enunciado.replace(/<[^>]+>/g, "").slice(0, 400)}</div>
          )}
          <div>
            <Button size="sm" variant="outline" onClick={analisarComIA} disabled={analisando} className="text-primary">
              {analisando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Analisar com IA
            </Button>
          </div>
          {aiResult && (
            <div className={`rounded-md p-2 text-[11px] space-y-1 border ${aiResult.procedente ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${aiResult.procedente ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                  IA: {aiResult.procedente ? "PROCEDENTE (anular)" : "IMPROCEDENTE (manter)"}
                </span>
                <span className="text-[10px] text-muted-foreground">Confiança: {Math.round((aiResult.confianca || 0) * 100)}%</span>
                {aiResult.needs_human_review && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-semibold">Requer revisão humana</span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{aiResult.provider}</span>
              </div>
              <div className="whitespace-pre-wrap"><strong>Parecer da IA:</strong> {aiResult.justificativa}</div>
              <p className="text-[10px] text-muted-foreground italic">Sugestão pré-preenchida no campo de justificativa abaixo — revise antes de decidir.</p>
            </div>
          )}
          {decidido && !editando && (
            <>
              <div className="text-[11px] italic text-muted-foreground whitespace-pre-wrap"><strong>Decisão atual ({recurso.status}):</strong> {recurso.decisao_admin || "—"}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setJust(recurso.decisao_admin ?? ""); setEditando(true); }}>
                  Editar decisão
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReabrir()}>
                  Reabrir p/ reanálise
                </Button>
              </div>
            </>
          )}
          {emEdicao && (
            <>
              <Textarea value={just} onChange={(e) => setJust(e.target.value)} placeholder="Justificativa da decisão..." className="min-h-[60px] text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={async () => { await onDecidir("procedente", just); setEditando(false); }} className="bg-success hover:bg-success/90 text-white">
                  <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> Deferir e anular questão
                </Button>
                <Button size="sm" variant="outline" onClick={async () => { await onDecidir("improcedente", just); setEditando(false); }} className="text-destructive">
                  <ThumbsDown className="w-3.5 h-3.5 mr-1.5" /> Indeferir
                </Button>
                {decidido && (
                  <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

