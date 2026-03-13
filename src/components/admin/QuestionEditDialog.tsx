import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import type { Questao } from "./AdminQuestoesTab";

interface Props {
  question: Questao | null;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  onChange: (q: Questao) => void;
}

export function QuestionEditDialog({ question, onClose, onSave, saving, onChange }: Props) {
  if (!question) return null;

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
            <label className="text-xs text-muted-foreground">Comentário</label>
            <Textarea value={question.comentario} onChange={(e) => onChange({ ...question, comentario: e.target.value })} rows={3} />
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
