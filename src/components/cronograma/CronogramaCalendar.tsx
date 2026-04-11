import { useState } from "react";
import { AtividadeBloco, DIAS_SEMANA_ORDER, getDiaLabel, getCorDisciplina, TIPO_LABELS } from "@/lib/cronograma-generator";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  atividades: AtividadeBloco[];
  diasSemana: string[];
  onBlockClick?: (bloco: AtividadeBloco) => void;
}

export function CronogramaCalendar({ atividades, diasSemana, onBlockClick }: Props) {
  const orderedDias = DIAS_SEMANA_ORDER.filter(d => diasSemana.includes(d));
  const [mobileDay, setMobileDay] = useState(0);

  const atividadesPorDia: Record<string, AtividadeBloco[]> = {};
  orderedDias.forEach(d => { atividadesPorDia[d] = []; });
  atividades.forEach(a => {
    if (atividadesPorDia[a.dia_semana]) {
      atividadesPorDia[a.dia_semana].push(a);
    }
  });
  // Sort by time
  Object.values(atividadesPorDia).forEach(arr => arr.sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio)));

  const maxBlocks = Math.max(1, ...Object.values(atividadesPorDia).map(a => a.length));

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${orderedDias.length}, minmax(140px, 1fr))` }}>
          {orderedDias.map(dia => (
            <div key={dia} className="text-center font-bold text-sm py-2 rounded-t-lg bg-muted/60">
              {getDiaLabel(dia)}
            </div>
          ))}
          {Array.from({ length: maxBlocks }).map((_, idx) => (
            orderedDias.map(dia => {
              const bloco = atividadesPorDia[dia]?.[idx];
              if (!bloco) return <div key={`${dia}-${idx}`} className="p-2" />;
              return (
                <div
                  key={bloco.id}
                  onClick={() => onBlockClick?.(bloco)}
                  className={cn(
                    "rounded-lg p-2.5 text-xs cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md border border-transparent hover:border-foreground/10",
                  )}
                  style={{
                    backgroundColor: getCorDisciplina(bloco.disciplina) + "20",
                    borderLeft: `3px solid ${getCorDisciplina(bloco.disciplina)}`,
                  }}
                >
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {bloco.horario_inicio} - {bloco.horario_fim}
                  </div>
                  <div className="font-semibold mt-0.5" style={{ color: getCorDisciplina(bloco.disciplina) }}>
                    {bloco.disciplina}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{TIPO_LABELS[bloco.tipo_atividade]}</div>
                </div>
              );
            })
          ))}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => setMobileDay(Math.max(0, mobileDay - 1))}
            disabled={mobileDay === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-bold text-lg">{getDiaLabel(orderedDias[mobileDay])}</span>
          <Button
            variant="ghost" size="icon"
            onClick={() => setMobileDay(Math.min(orderedDias.length - 1, mobileDay + 1))}
            disabled={mobileDay === orderedDias.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
        <div className="space-y-2">
          {(atividadesPorDia[orderedDias[mobileDay]] || []).map(bloco => (
            <div
              key={bloco.id}
              onClick={() => onBlockClick?.(bloco)}
              className="rounded-lg p-3 cursor-pointer transition-all hover:shadow-md"
              style={{
                backgroundColor: getCorDisciplina(bloco.disciplina) + "15",
                borderLeft: `4px solid ${getCorDisciplina(bloco.disciplina)}`,
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold" style={{ color: getCorDisciplina(bloco.disciplina) }}>
                  {bloco.disciplina}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {bloco.horario_inicio} - {bloco.horario_fim}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{TIPO_LABELS[bloco.tipo_atividade]}</div>
            </div>
          ))}
          {(atividadesPorDia[orderedDias[mobileDay]] || []).length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma atividade neste dia</p>
          )}
        </div>
      </div>
    </>
  );
}
