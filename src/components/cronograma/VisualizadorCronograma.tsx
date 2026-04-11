import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CronogramaCalendar } from "./CronogramaCalendar";
import { CronogramaResumoTable } from "./CronogramaResumoTable";
import { EditarBlocoDialog } from "./EditarBlocoDialog";
import { CronogramaData, AtividadeBloco, DIAS_SEMANA_ORDER, getDiaLabel, DISCIPLINAS, DisciplinaNome, getCorDisciplina } from "@/lib/cronograma-generator";
import { Save, ArrowLeft, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  cronograma: CronogramaData;
  onBack: () => void;
  onSaved?: () => void;
  existingId?: string;
}

export function VisualizadorCronograma({ cronograma: initial, onBack, onSaved, existingId }: Props) {
  const { user } = useAuth();
  const [atividades, setAtividades] = useState<AtividadeBloco[]>(initial.atividades);
  const [editBloco, setEditBloco] = useState<AtividadeBloco | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addDay, setAddDay] = useState<string>("");

  const handleSaveBlock = (updated: AtividadeBloco) => {
    setAtividades(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const handleDeleteBlock = (id: string) => {
    setAtividades(prev => prev.filter(a => a.id !== id));
  };

  const handleAddBlock = () => {
    if (!addDay) return;
    const newBlock: AtividadeBloco = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      dia_semana: addDay,
      horario_inicio: initial.horario_inicio,
      horario_fim: "20:00",
      disciplina: DISCIPLINAS[0].nome,
      tipo_atividade: "videoaula",
      duracao_minutos: 60,
    };
    setEditBloco(newBlock);
    setAtividades(prev => [...prev, newBlock]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        nome: initial.nome,
        tipo: initial.tipo,
        horas_semanais: initial.horas_semanais,
        distribuicao: initial.distribuicao as any,
        dias_semana: initial.dias_semana,
        horario_inicio: initial.horario_inicio,
        horario_fim: initial.horario_fim,
        atividades: atividades as any,
      };

      if (existingId) {
        const { error } = await supabase.from("cronogramas").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cronogramas").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Cronograma salvo!", description: "Seu cronograma foi salvo com sucesso." });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const diasAtivos = DIAS_SEMANA_ORDER.filter(d => initial.dias_semana.includes(d));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{initial.nome}</h2>
          <p className="text-sm text-muted-foreground">{initial.horas_semanais}h semanais • {initial.dias_semana.length} dias</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <Pencil className="w-4 h-4 mr-1" /> {editing ? "Concluir Edição" : "Editar"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {editing && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Adicionar bloco ao dia:</label>
                <Select value={addDay} onValueChange={setAddDay}>
                  <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                  <SelectContent>
                    {diasAtivos.map(d => (
                      <SelectItem key={d} value={d}>{getDiaLabel(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleAddBlock} disabled={!addDay}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calendário Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <CronogramaCalendar
            atividades={atividades}
            diasSemana={initial.dias_semana}
            onBlockClick={editing ? setEditBloco : undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo de Horas</CardTitle>
        </CardHeader>
        <CardContent>
          <CronogramaResumoTable atividades={atividades} />
        </CardContent>
      </Card>

      <EditarBlocoDialog
        bloco={editBloco}
        open={!!editBloco}
        onClose={() => setEditBloco(null)}
        onSave={handleSaveBlock}
        onDelete={handleDeleteBlock}
      />
    </motion.div>
  );
}
