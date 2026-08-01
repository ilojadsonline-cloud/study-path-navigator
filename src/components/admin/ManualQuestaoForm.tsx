import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, ChevronDown, Save } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { sanitizeRichHtml, htmlToPlainText } from "@/lib/sanitize-html";
import { useCurso } from "@/contexts/CursoContext";
import { getQtdAlternativas } from "@/lib/edital-distribuicao";

const ALT_LETTERS = ["A", "B", "C", "D", "E"] as const;
const DIFICULDADES = ["Fácil", "Médio", "Difícil"];

interface Props {
  disciplinas: string[];
  onCreated?: () => void;
}

export function ManualQuestaoForm({ disciplinas, onCreated }: Props) {
  const { toast } = useToast();
  const { cursoSlug } = useCurso();
  const qtdAlternativas = getQtdAlternativas(cursoSlug);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [disciplina, setDisciplina] = useState(disciplinas[0] || "");
  const [assunto, setAssunto] = useState("");
  const [dificuldade, setDificuldade] = useState("Médio");
  const [banca, setBanca] = useState("");
  const [prova, setProva] = useState("");
  const [ano, setAno] = useState<string>(String(new Date().getFullYear()));
  const [enunciado, setEnunciado] = useState("");
  const [alternativas, setAlternativas] = useState<string[]>(() => Array(qtdAlternativas).fill(""));
  const [gabarito, setGabarito] = useState(0);
  const [comentario, setComentario] = useState("");

  const resetForm = () => {
    setAssunto("");
    setBanca("");
    setProva("");
    setEnunciado("");
    setAlternativas(Array(qtdAlternativas).fill(""));
    setGabarito(0);
    setComentario("");
  };

  const setAlt = (i: number, v: string) => {
    setAlternativas((prev) => prev.map((a, idx) => (idx === i ? v : a)));
  };

  const handleSave = async () => {
    // Validação baseada no texto puro (ignora marcação HTML do editor).
    if (!disciplina.trim()) {
      toast({ title: "Verifique os campos", description: "Selecione a disciplina.", variant: "destructive" });
      return;
    }
    if (assunto.trim().length < 2) {
      toast({ title: "Verifique os campos", description: "Informe o assunto.", variant: "destructive" });
      return;
    }
    if (htmlToPlainText(enunciado).length < 20) {
      toast({ title: "Verifique os campos", description: "Enunciado muito curto.", variant: "destructive" });
      return;
    }
    if (alternativas.some((a) => htmlToPlainText(a).length < 1)) {
      toast({ title: "Verifique os campos", description: "Preencha todas as alternativas.", variant: "destructive" });
      return;
    }
    if (htmlToPlainText(comentario).length < 10) {
      toast({ title: "Verifique os campos", description: "Inclua um comentário/justificativa.", variant: "destructive" });
      return;
    }
    const anoNum = ano ? Number(ano) : null;

    setSaving(true);
    const { error } = await supabase.from("questoes").insert({
      disciplina: disciplina.trim(),
      assunto: assunto.trim(),
      dificuldade,
      banca: banca.trim() || null,
      prova: prova.trim() || null,
      ano: anoNum,
      origem: "manual",
      enunciado: sanitizeRichHtml(enunciado),
      alt_a: sanitizeRichHtml(alternativas[0]),
      alt_b: sanitizeRichHtml(alternativas[1]),
      alt_c: sanitizeRichHtml(alternativas[2]),
      alt_d: sanitizeRichHtml(alternativas[3]),
      alt_e: alternativas[4] ? sanitizeRichHtml(alternativas[4]) : "",
      gabarito,
      comentario: sanitizeRichHtml(comentario),
      audit_status: "approved",
      curso_id: cursoId,
    } as any);
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Questão criada!", description: "A questão manual foi adicionada ao banco." });
    resetForm();
    onCreated?.();
  };


  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <PlusCircle className="w-5 h-5 text-primary" />
          Criar questão manualmente
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-4">
          <p className="text-xs text-muted-foreground">
            Cadastre uma questão de prova real informando banca, ano e prova. Ela entra no banco já aprovada.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Disciplina</Label>
              <select
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                className="w-full rounded-lg bg-secondary border-none text-sm p-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
              >
                {disciplinas.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assunto</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Hierarquia e disciplina" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dificuldade</Label>
              <select
                value={dificuldade}
                onChange={(e) => setDificuldade(e.target.value)}
                className="w-full rounded-lg bg-secondary border-none text-sm p-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
              >
                {DIFICULDADES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Banca</Label>
              <Input value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="Ex.: UNESC" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Input
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="2026"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prova</Label>
              <Input value={prova} onChange={(e) => setProva(e.target.value)} placeholder="Ex.: Prefeitura - Cargo - 2026" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Enunciado</Label>
            <RichTextEditor
              value={enunciado}
              onChange={setEnunciado}
              allowImage
              minHeight={120}
              placeholder="Texto da questão. Use a barra para formatar e inserir imagem se necessário."
            />
          </div>


          <div className="space-y-2">
            <Label className="text-xs">Alternativas (marque a correta)</Label>
            {alternativas.map((alt, i) => (
              <div key={i} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setGabarito(i)}
                  title="Definir como gabarito"
                  className={`mt-1 w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold transition-all ${
                    gabarito === i
                      ? "bg-success text-success-foreground border-success"
                      : "bg-secondary text-muted-foreground border-transparent hover:border-primary/40"
                  }`}
                  translate="no"
                >
                  {ALT_LETTERS[i]}
                </button>
                <div className="flex-1">
                  <RichTextEditor
                    value={alt}
                    onChange={(v) => setAlt(i, v)}
                    minHeight={44}
                    placeholder={`Alternativa ${ALT_LETTERS[i]}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Comentário / Justificativa</Label>
            <RichTextEditor
              value={comentario}
              onChange={setComentario}
              minHeight={120}
              placeholder="Explique o gabarito e por que cada distrator está incorreto..."
            />
          </div>


          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground font-bold">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Questão
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={saving}>
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManualQuestaoForm;
