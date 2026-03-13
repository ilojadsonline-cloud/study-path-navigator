import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Pencil, Trash2 } from "lucide-react";
import type { Questao } from "./AdminQuestoesTab";

interface Props {
  question: Questao | null;
  onClose: () => void;
  onEdit: (q: Questao) => void;
  onDelete: (q: Questao) => void;
}

export function QuestionViewDialog({ question, onClose, onEdit, onDelete }: Props) {
  if (!question) return null;

  return (
    <Dialog open={!!question} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-sm font-mono text-muted-foreground">Questão #{question.id}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{question.disciplina} · {question.assunto} · {question.dificuldade}</p>
            <p className="text-sm">{question.enunciado}</p>
          </div>
          <div className="space-y-2">
            {[question.alt_a, question.alt_b, question.alt_c, question.alt_d, question.alt_e].map((alt, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${i === question.gabarito ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
                <span className="font-bold text-xs mt-0.5" translate="no">{["A", "B", "C", "D", "E"][i]})</span>
                <span>{alt}</span>
                {i === question.gabarito && <CheckCircle className="w-4 h-4 text-primary shrink-0 ml-auto" />}
              </div>
            ))}
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário:</p>
            <p className="text-sm">{question.comentario}</p>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(question)}>
            <Pencil className="w-4 h-4 mr-1" /> Editar
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(question)}>
            <Trash2 className="w-4 h-4 mr-1" /> Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
