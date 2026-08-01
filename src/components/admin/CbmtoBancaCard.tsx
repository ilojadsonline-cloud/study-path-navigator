import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurso } from "@/contexts/CursoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldCheck, Upload, Wrench } from "lucide-react";
import {
  ANO_CBMTO,
  BANCA_CBMTO,
  CRITERIOS_MATRIZ_CBMTO,
  DIFICULDADE_CBMTO,
  ESCOPO_CBMTO,
  LETRAS_CBMTO,
  PROVA_CBMTO,
} from "@/lib/escopo-cbmto";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  aprovada: { label: "Aprovada", className: "bg-green-500/15 text-green-500 border-green-500/30" },
  correcao_necessaria: { label: "Correção necessária", className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  quarentena: { label: "Quarentena", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  reprovada: { label: "Reprovada", className: "bg-destructive/15 text-destructive border-destructive/30" },
  publicada: { label: "Publicada", className: "bg-primary/15 text-primary border-primary/30" },
};

interface Questao {
  id: string;
  disciplina: string;
  assunto: string | null;
  enunciado: string;
  alt_a: string; alt_b: string; alt_c: string; alt_d: string;
  gabarito: number;
  comentario: string | null;
  analise_alternativas: string | null;
  dica_prova: string | null;
  base_normativa: string | null;
  arquivo_fonte: string | null;
  status: string;
  pontuacao: number;
  criterios: any;
  relatorio_auditoria: any;
  lote_id: string | null;
  created_at: string;
}

export function CbmtoBancaCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { cursoId } = useCurso();
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("todas");
  const [disciplina, setDisciplina] = useState<string>("todas");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("cbmto_questoes_editoriais")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "todas") q = q.eq("status", status);
    if (disciplina !== "todas") q = q.eq("disciplina", disciplina);
    const { data } = await q;
    setQuestoes((data as unknown as Questao[]) ?? []);
    setSelecionadas(new Set());
    setLoading(false);
  }, [status, disciplina]);

  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  const toggle = (id: string) => {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const auditar = async (corrigir: boolean) => {
    const ids = selecionadas.size ? [...selecionadas] : questoes.map((q) => q.id);
    if (!ids.length) return;
    setProcessando(true);
    const { data, error } = await supabase.functions.invoke("cbmto-auditar-questao", {
      body: { ids, corrigir },
    });
    setProcessando(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? "Falha na auditoria.");
      return;
    }
    toast.success(`${(data as any).auditadas} questão(ões) auditada(s).`);
    carregar();
  };

  const publicar = async () => {
    const alvo = questoes.filter((q) => selecionadas.has(q.id) && q.status === "aprovada");
    if (!alvo.length) {
      toast.error("Selecione questões com status Aprovada.");
      return;
    }
    setProcessando(true);
    let ok = 0;
    for (const q of alvo) {
      const comentario = [q.comentario, q.analise_alternativas, q.dica_prova, q.base_normativa]
        .filter(Boolean)
        .join("\n\n");
      const { data: inserida, error } = await supabase
        .from("questoes")
        .insert({
          curso_id: cursoId,
          disciplina: q.disciplina,
          assunto: q.assunto ?? q.disciplina,
          dificuldade: DIFICULDADE_CBMTO,
          enunciado: q.enunciado,
          alt_a: q.alt_a, alt_b: q.alt_b, alt_c: q.alt_c, alt_d: q.alt_d, alt_e: "",
          gabarito: q.gabarito,
          comentario,
          banca: BANCA_CBMTO,
          ano: ANO_CBMTO,
          prova: PROVA_CBMTO,
          origem: "editorial_cbmto",
          audit_status: "approved",
        })
        .select("id")
        .single();
      if (error) continue;
      await supabase
        .from("cbmto_questoes_editoriais")
        .update({ status: "publicada", questao_id: inserida.id })
        .eq("id", q.id);
      ok++;
    }
    setProcessando(false);
    toast.success(`${ok} questão(ões) publicada(s) no banco CBMTO.`);
    carregar();
  };

  const resumo = useMemo(() => {
    const c: Record<string, number> = {};
    for (const q of questoes) c[q.status] = (c[q.status] ?? 0) + 1;
    return c;
  }, [questoes]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Banca editorial e auditoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              {Object.keys(STATUS_LABEL).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={disciplina} onValueChange={setDisciplina}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="todas">Todas as disciplinas</SelectItem>
              {ESCOPO_CBMTO.map((e) => (
                <SelectItem key={e.disciplina} value={e.disciplina}>{e.disciplina}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {Object.entries(resumo).map(([s, n]) => (
              <Badge key={s} variant="outline" className={STATUS_LABEL[s]?.className}>
                {STATUS_LABEL[s]?.label ?? s}: {n}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => auditar(false)} disabled={processando}>
            {processando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Auditar {selecionadas.size ? `(${selecionadas.size})` : "tudo"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => auditar(true)} disabled={processando}>
            <Wrench className="w-4 h-4 mr-2" /> Auditar e corrigir
          </Button>
          <Button size="sm" variant="secondary" onClick={publicar} disabled={processando || !selecionadas.size}>
            <Upload className="w-4 h-4 mr-2" /> Publicar aprovadas
          </Button>
        </div>

        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
        {!loading && questoes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma questão editorial neste filtro.</p>
        )}

        <Accordion type="multiple" className="space-y-2">
          {questoes.map((q) => {
            const st = STATUS_LABEL[q.status] ?? { label: q.status, className: "" };
            const rel = q.relatorio_auditoria ?? {};
            const falhas = ["estrutural", "normativa", "editorial", "psicometrica", "ineditismo"]
              .flatMap((c) => (rel?.[c] ?? []) as any[]);
            const criterios: boolean[] = Array.isArray(q.criterios) ? q.criterios : [];
            return (
              <AccordionItem key={q.id} value={q.id} className="border rounded-md px-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-4"
                    checked={selecionadas.has(q.id)}
                    onCheckedChange={() => toggle(q.id)}
                  />
                  <AccordionTrigger className="flex-1 text-left hover:no-underline">
                    <div className="min-w-0 pr-2">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge variant="outline" className={st.className}>{st.label}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{q.disciplina}</Badge>
                        <Badge variant="outline" className="text-[10px]">{q.pontuacao}/11</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{q.enunciado}</p>
                    </div>
                  </AccordionTrigger>
                </div>
                <AccordionContent className="space-y-3 text-xs">
                  <p className="whitespace-pre-wrap">{q.enunciado}</p>
                  <ul className="space-y-1">
                    {LETRAS_CBMTO.map((l, i) => (
                      <li key={l} className={i === q.gabarito ? "text-green-500 font-medium" : ""}>
                        {l}) {[q.alt_a, q.alt_b, q.alt_c, q.alt_d][i]}
                      </li>
                    ))}
                  </ul>
                  {q.comentario && <p className="whitespace-pre-wrap"><span className="font-medium">Comentário:</span> {q.comentario}</p>}
                  {q.analise_alternativas && <p className="whitespace-pre-wrap"><span className="font-medium">Alternativas:</span> {q.analise_alternativas}</p>}
                  {q.base_normativa && <p><span className="font-medium">Base normativa:</span> {q.base_normativa}</p>}
                  {q.arquivo_fonte && <p><span className="font-medium">Fonte:</span> {q.arquivo_fonte}</p>}

                  {criterios.length === 11 && (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {CRITERIOS_MATRIZ_CBMTO.map((c, i) => (
                        <span key={c} className={criterios[i] ? "text-green-500" : "text-destructive"}>
                          {criterios[i] ? "✔" : "✘"} {i + 1}. {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {falhas.length > 0 && (
                    <div className="rounded-md border border-destructive/30 p-2 space-y-1">
                      <p className="font-medium text-destructive">Falhas apontadas</p>
                      {falhas.map((f, i) => (
                        <p key={i}>
                          <Badge variant="outline" className="text-[10px] mr-1">{f.camada}/{f.severidade}</Badge>
                          {f.motivo} <span className="text-muted-foreground">({f.regra})</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {rel?.resumo_ia && <p className="text-muted-foreground">{rel.resumo_ia}</p>}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
