import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurso } from "@/contexts/CursoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, FileWarning, Loader2, Upload } from "lucide-react";
import { ARQUIVOS_MARKDOWN_CBMTO, EDITAIS_PDF_CBMTO, ESCOPO_CBMTO } from "@/lib/escopo-cbmto";

interface Fonte {
  id: string;
  arquivo: string;
  disciplina: string | null;
  tipo: string;
  papel: string;
  status: string;
  versao: string;
  data_documento: string | null;
  conteudo: string | null;
  updated_at: string;
}

export function CbmtoFontesCard() {
  const { cursoId } = useCurso();
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [versao, setVersao] = useState("1");
  const [dataDoc, setDataDoc] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cbmto_fontes_oficiais")
      .select("id, arquivo, disciplina, tipo, papel, status, versao, data_documento, conteudo, updated_at")
      .order("arquivo");
    setFontes((data as Fonte[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const fontePorArquivo = (arquivo: string) => fontes.find((f) => f.arquivo === arquivo);

  const abrir = (arquivo: string) => {
    const f = fontePorArquivo(arquivo);
    setSelecionado(arquivo);
    setConteudo(f?.conteudo ?? "");
    setVersao(f?.versao ?? "1");
    setDataDoc(f?.data_documento ?? "");
  };

  const salvar = async (status: "validada" | "pendente") => {
    if (!selecionado) return;
    if (status === "validada" && !conteudo.trim()) {
      toast.error("Cole o conteúdo da fonte antes de validar.");
      return;
    }
    setSalvando(true);
    const escopo = ESCOPO_CBMTO.find((e) => e.arquivo === selecionado);
    const ehEdital = EDITAIS_PDF_CBMTO.some((e) => e.arquivo === selecionado);
    const payload = {
      arquivo: selecionado,
      disciplina: escopo?.disciplina ?? null,
      tipo: ehEdital ? "pdf" : "markdown",
      papel: ehEdital ? "edital" : "conteudo",
      curso_id: cursoId,
      conteudo,
      versao,
      data_documento: dataDoc || null,
      status,
      capitulos_autorizados: escopo?.capitulosAutorizados ?? [],
      capitulos_excluidos: escopo?.capitulosExcluidos ?? [],
      artigos_autorizados: escopo?.artigosAutorizados ?? [],
      observacao: escopo?.observacao ?? null,
    };
    const existente = fontePorArquivo(selecionado);
    const { error } = existente
      ? await supabase.from("cbmto_fontes_oficiais").update(payload).eq("id", existente.id)
      : await supabase.from("cbmto_fontes_oficiais").insert(payload);
    setSalvando(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success(status === "validada" ? "Fonte validada." : "Fonte salva como pendente.");
    carregar();
  };

  const onArquivo = async (file: File) => {
    const texto = await file.text();
    setConteudo(texto);
    toast.success(`${file.name} carregado (${texto.length.toLocaleString("pt-BR")} caracteres).`);
  };

  const lista = [
    ...EDITAIS_PDF_CBMTO.map((e) => ({ arquivo: e.arquivo, rotulo: e.descricao, papel: "Edital" })),
    ...ARQUIVOS_MARKDOWN_CBMTO.map((a) => ({
      arquivo: a,
      rotulo: ESCOPO_CBMTO.find((e) => e.arquivo === a)?.disciplina ?? a,
      papel: "Conteúdo",
    })),
  ];

  const validadas = fontes.filter((f) => f.status === "validada").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Biblioteca de fontes
            <Badge variant="secondary">{validadas}/{lista.length} validadas</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 max-h-[520px] overflow-y-auto">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {lista.map((item) => {
            const f = fontePorArquivo(item.arquivo);
            const ok = f?.status === "validada";
            return (
              <button
                key={item.arquivo}
                onClick={() => abrir(item.arquivo)}
                className={`w-full text-left p-2 rounded-md border transition-colors ${
                  selecionado === item.arquivo ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-2">
                  {ok ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <FileWarning className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.rotulo}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.arquivo}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selecionado ? selecionado : "Selecione uma fonte"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selecionado && (
            <p className="text-sm text-muted-foreground">
              A geração e a auditoria só usam fontes locais validadas. Nenhuma questão é criada sem a fonte
              correspondente cadastrada aqui.
            </p>
          )}
          {selecionado && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Versão</Label>
                  <Input value={versao} onChange={(e) => setVersao(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Data do documento</Label>
                  <Input type="date" value={dataDoc ?? ""} onChange={(e) => setDataDoc(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Arquivo (.md / .txt)</Label>
                  <Input
                    type="file"
                    accept=".md,.txt,.markdown"
                    onChange={(e) => e.target.files?.[0] && onArquivo(e.target.files[0])}
                  />
                </div>
              </div>
              <Textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={16}
                placeholder="Cole aqui o conteúdo integral da fonte autorizada…"
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => salvar("validada")} disabled={salvando}>
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Salvar e validar
                </Button>
                <Button variant="outline" onClick={() => salvar("pendente")} disabled={salvando}>
                  Salvar como pendente
                </Button>
                <span className="text-xs text-muted-foreground">
                  {conteudo.length.toLocaleString("pt-BR")} caracteres
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
