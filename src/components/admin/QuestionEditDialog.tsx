import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Questao } from "./AdminQuestoesTab";

interface Props {
  question: Questao | null;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  onChange: (q: Questao) => void;
}

export function QuestionEditDialog({ question, onClose, onSave, saving, onChange }: Props) {
  const [regenerating, setRegenerating] = useState(false);
  if (!question) return null;

  const handleRegenerateComment = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("regenerate-comment", {
        body: { question_id: question.id, apply: false },
      });
      if (error) throw error;
      if (data?.status === "comentario_validado" && data?.comentario) {
        onChange({ ...question, comentario: data.comentario });
        toast.success("Comentário pedagógico gerado. Revise e salve.");
      } else if (data?.status === "revisao_necessaria") {
        toast.error(`Revisão necessária: ${data.motivo ?? data.tipo_problema ?? "problema na questão"}`);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error("Não foi possível gerar o comentário.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao regenerar comentário.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={!!question} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Questão #{question.id}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Disciplina</label>
              <Input value={question.disciplina} onChange={(e) => onChange({ ...question, disciplina: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Assunto</label>
              <Input value={question.assunto} onChange={(e) => onChange({ ...question, assunto: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Dificuldade</label>
              <Select value={question.dificuldade} onValueChange={(v) => onChange({ ...question, dificuldade: v })}>
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
            <Textarea value={question.enunciado} onChange={(e) => onChange({ ...question, enunciado: e.target.value })} rows={3} />
          </div>
          {(["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const).map((key, i) => (
            <div key={key} className="flex items-start gap-2">
              <div className="flex items-center gap-1 mt-2">
                <input type="radio" name="gabarito" checked={question.gabarito === i}
                  onChange={() => onChange({ ...question, gabarito: i })} className="accent-primary" />
                <span translate="no" className="text-xs font-bold">{["A", "B", "C", "D", "E"][i]}</span>
              </div>
              <Textarea value={question[key]} onChange={(e) => onChange({ ...question, [key]: e.target.value })} rows={1} className="flex-1" />
            </div>
          ))}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Comentário</label>
              <Button type="button" variant="outline" size="sm" onClick={handleRegenerateComment} disabled={regenerating}>
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                {regenerating ? "Gerando..." : "Regenerar (professor)"}
              </Button>
            </div>
            <Textarea value={question.comentario} onChange={(e) => onChange({ ...question, comentario: e.target.value })} rows={6} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving} className="gradient-primary text-primary-foreground font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
