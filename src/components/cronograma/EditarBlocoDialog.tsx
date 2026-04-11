import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AtividadeBloco, DISCIPLINAS, DisciplinaNome, TipoAtividade, TIPO_LABELS } from "@/lib/cronograma-generator";
import { Trash2 } from "lucide-react";

interface Props {
  bloco: AtividadeBloco | null;
  open: boolean;
  onClose: () => void;
  onSave: (bloco: AtividadeBloco) => void;
  onDelete: (id: string) => void;
}

export function EditarBlocoDialog({ bloco, open, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<AtividadeBloco | null>(null);

  useEffect(() => {
    if (bloco) setForm({ ...bloco });
  }, [bloco]);

  if (!form) return null;

  const handleSave = () => {
    const [sh, sm] = form.horario_inicio.split(":").map(Number);
    const [eh, em] = form.horario_fim.split(":").map(Number);
    const duracao = (eh * 60 + em) - (sh * 60 + sm);
    onSave({ ...form, duracao_minutos: Math.max(duracao, 0) });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Bloco</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Disciplina</Label>
            <Select value={form.disciplina} onValueChange={v => setForm({ ...form, disciplina: v as DisciplinaNome })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISCIPLINAS.map(d => (
                  <SelectItem key={d.nome} value={d.nome}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Atividade</Label>
            <Select value={form.tipo_atividade} onValueChange={v => setForm({ ...form, tipo_atividade: v as TipoAtividade })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TIPO_LABELS) as [TipoAtividade, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="time" value={form.horario_inicio} onChange={e => setForm({ ...form, horario_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={form.horario_fim} onChange={e => setForm({ ...form, horario_fim: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={() => { onDelete(form.id); onClose(); }}>
            <Trash2 className="w-4 h-4 mr-1" /> Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
