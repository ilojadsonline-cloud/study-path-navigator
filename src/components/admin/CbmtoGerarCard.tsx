import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurso } from "@/contexts/CursoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  COTAS_OFICIAIS_CBMTO,
  ESCOPO_CBMTO,
  FORMATOS_COGNITIVOS_CBMTO,
  TOTAL_QUESTOES_SIMULADO_CBMTO,
  cotasGabaritoOficial,
} from "@/lib/escopo-cbmto";

export function CbmtoGerarCard({ onGerado }: { onGerado?: () => void }) {
  const { cursoId } = useCurso();
  const [modo, setModo] = useState<"individual" | "lote" | "simulado_oficial">("lote");
  const [disciplina, setDisciplina] = useState(ESCOPO_CBMTO[0]?.disciplina ?? "");
  const [quantidade, setQuantidade] = useState(3);
  const [assunto, setAssunto] = useState("");
  const [formato, setFormato] = useState<string>("auto");
  const [observacoes, setObservacoes] = useState("");
  const [compararBanco, setCompararBanco] = useState(true);
  const [indiceSimulado, setIndiceSimulado] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const cotasGabarito = cotasGabaritoOficial(indiceSimulado);

  const gerar = async () => {
    setLoading(true);
    setResultado(null);
    const { data, error } = await supabase.functions.invoke("cbmto-gerar-questoes", {
      body: {
        curso_id: cursoId,
        modo,
        disciplina,
        quantidade,
        assunto: assunto.trim() || null,
        formato: formato === "auto" ? null : formato,
        observacoes,
        comparar_banco: compararBanco,
        indice_simulado: indiceSimulado,
        seed: Math.floor(Math.random() * 100000),
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Falha na geração. Verifique as fontes validadas e tente novamente.");
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).mensagem ?? (data as any).error);
      setResultado(data);
      return;
    }
    setResultado(data);
    toast.success(`${(data as any).geradas} questão(ões) gerada(s). Rode a auditoria antes de publicar.`);
    onGerado?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Geração controlada — CHOA CBMTO 2026
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Modo</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Questão individual</SelectItem>
                <SelectItem value="lote">Lote por disciplina</SelectItem>
                <SelectItem value="simulado_oficial">Simulado oficial ({TOTAL_QUESTOES_SIMULADO_CBMTO} questões)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {modo !== "simulado_oficial" && (
            <>
              <div className="sm:col-span-2">
                <Label className="text-xs">Disciplina do edital</Label>
                <Select value={disciplina} onValueChange={setDisciplina}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {ESCOPO_CBMTO.map((e) => (
                      <SelectItem key={e.disciplina} value={e.disciplina}>{e.disciplina}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  disabled={modo === "individual"}
                />
              </div>
              <div>
                <Label className="text-xs">Assunto (opcional)</Label>
                <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="subtópico autorizado" />
              </div>
              <div>
                <Label className="text-xs">Formato</Label>
                <Select value={formato} onValueChange={setFormato}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Variar automaticamente</SelectItem>
                    {FORMATOS_COGNITIVOS_CBMTO.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {modo === "simulado_oficial" && (
            <div>
              <Label className="text-xs">Índice do simulado (rotação de gabarito)</Label>
              <Input type="number" min={0} value={indiceSimulado} onChange={(e) => setIndiceSimulado(Number(e.target.value))} />
            </div>
          )}
        </div>

        {modo === "simulado_oficial" && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-medium">Cotas obrigatórias do edital</p>
            <div className="flex flex-wrap gap-1.5">
              {COTAS_OFICIAIS_CBMTO.map((c) => (
                <Badge key={c.cota} variant="secondary" className="text-[10px]">{c.cota}: {c.questoes}</Badge>
              ))}
            </div>
            <p className="text-xs font-medium pt-1">Distribuição planejada de gabaritos</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(cotasGabarito).map(([letra, qtd]) => (
                <Badge key={letra} variant="outline" className="text-[10px]">{letra}: {qtd}</Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Observações editoriais</Label>
          <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: priorizar decisão operacional em cena com vítima presa em ferragens." />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={compararBanco} onCheckedChange={setCompararBanco} id="cmp" />
          <Label htmlFor="cmp" className="text-xs">Comparar com o banco para garantir ineditismo material</Label>
        </div>

        <Button onClick={gerar} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Gerar questões
        </Button>

        {resultado && (
          <div className="rounded-md border p-3 text-xs space-y-1">
            {resultado.error ? (
              <p className="text-destructive">{resultado.mensagem ?? resultado.error}</p>
            ) : (
              <>
                <p><span className="font-medium">Geradas:</span> {resultado.geradas}</p>
                {resultado.descartadas?.length > 0 && (
                  <div>
                    <p className="font-medium text-amber-500">Descartadas:</p>
                    <ul className="list-disc pl-4">
                      {resultado.descartadas.map((d: any, i: number) => (
                        <li key={i}>{d.disciplina}: {d.motivo}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
