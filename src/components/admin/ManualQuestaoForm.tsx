import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, ChevronDown, Save } from "lucide-react";
import { z } from "zod";

const ALT_LETTERS = ["A", "B", "C", "D", "E"] as const;
const DIFICULDADES = ["Fácil", "Médio", "Difícil"];

const manualSchema = z.object({
  disciplina: z.string().trim().min(1, "Selecione a disciplina"),
  assunto: z.string().trim().min(2, "Informe o assunto").max(200),
  dificuldade: z.string().trim().min(1),
  banca: z.string().trim().max(200).optional(),
  prova: z.string().trim().max(200).optional(),
  ano: z.number().int().min(1900).max(2100).optional(),
  enunciado: z.string().trim().min(20, "Enunciado muito curto").max(5000),
  alternativas: z
    .array(z.string().trim().min(1, "Preencha todas as alternativas").max(2000))
    .length(5),
  gabarito: z.number().int().min(0).max(4),
  comentario: z.string().trim().min(10, "Inclua um comentário/justificativa").max(5000),
});

interface Props {
  disciplinas: string[];
  onCreated?: () => void;
}

export function ManualQuestaoForm({ disciplinas, onCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [disciplina, setDisciplina] = useState(disciplinas[0] || "");
  const [assunto, setAssunto] = useState("");
  const [dificuldade, setDificuldade] = useState("Médio");
  const [banca, setBanca] = useState("");
  const [prova, setProva] = useState("");
  const [ano, setAno] = useState<string>(String(new Date().getFullYear()));
  const [enunciado, setEnunciado] = useState("");
  const [alternativas, setAlternativas] = useState<string[]>(["", "", "", "", ""]);
  const [gabarito, setGabarito] = useState(0);
  const [comentario, setComentario] = useState("");

  const resetForm = () => {
    setAssunto("");
    setBanca("");
    setProva("");
    setEnunciado("");
    setAlternativas(["", "", "", "", ""]);
    setGabarito(0);
    setComentario("");
  };

  const setAlt = (i: number, v: string) => {
    setAlternativas((prev) => prev.map((a, idx) => (idx === i ? v : a)));
  };

  const handleSave = async () => {
    const parsed = manualSchema.safeParse({
      disciplina,
      assunto,
      dificuldade,
      banca: banca || undefined,
      prova: prova || undefined,
      ano: ano ? Number(ano) : undefined,
      enunciado,
      alternativas,
      gabarito,
      comentario,
    });

    if (!parsed.success) {
      toast({
        title: "Verifique os campos",
        description: parsed.error.errors[0]?.message || "Dados inválidos.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const v = parsed.data;
    const { error } = await supabase.from("questoes").insert({
      disciplina: v.disciplina,
      assunto: v.assunto,
      dificuldade: v.dificuldade,
      banca: v.banca ?? null,
      prova: v.prova ?? null,
      ano: v.ano ?? null,
      origem: "manual",
      enunciado: v.enunciado,
      alt_a: v.alternativas[0],
      alt_b: v.alternativas[1],
      alt_c: v.alternativas[2],
      alt_d: v.alternativas[3],
      alt_e: v.alternativas[4],
      gabarito: v.gabarito,
      comentario: v.comentario,
      audit_status: "approved",
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

          <div className="space-y-1">
            <Label className="text-xs">Enunciado</Label>
            <Textarea
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              rows={4}
              placeholder="Texto da questão..."
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
                <Textarea
                  value={alt}
                  onChange={(e) => setAlt(i, e.target.value)}
                  rows={1}
                  className="min-h-[40px]"
                  placeholder={`Alternativa ${ALT_LETTERS[i]}`}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Comentário / Justificativa</Label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
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
