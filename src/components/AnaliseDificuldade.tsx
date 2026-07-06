import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Target, TrendingDown, TrendingUp } from "lucide-react";

export interface DesempenhoItem {
  name: string;
  total: number;
  corretas: number;
}

interface AnaliseDificuldadeProps {
  items: DesempenhoItem[];
  /** Amostra mínima de questões para um item aparecer no ranking de foco. */
  minAmostra?: number;
  /** Texto exibido quando não há dados suficientes. */
  emptyHint?: string;
  /** Rótulo do que está sendo medido (ex.: "disciplina", "assunto"). */
  unidade?: string;
}

function toneFor(pctAcerto: number) {
  if (pctAcerto >= 70) return { text: "text-success", bar: "from-success to-success/70", chip: "bg-success/15 text-success", label: "Domínio" };
  if (pctAcerto >= 50) return { text: "text-warning", bar: "from-warning to-warning/70", chip: "bg-warning/15 text-warning", label: "Atenção" };
  return { text: "text-destructive", bar: "from-destructive to-destructive/70", chip: "bg-destructive/15 text-destructive", label: "Crítico" };
}

export function AnaliseDificuldade({
  items,
  minAmostra = 1,
  emptyHint = "Resolva algumas questões para gerar sua análise.",
  unidade = "matéria",
}: AnaliseDificuldadeProps) {
  const valid = items
    .filter((i) => i.total >= minAmostra && i.total > 0)
    .map((i) => {
      const erros = i.total - i.corretas;
      const pctErro = Math.round((erros / i.total) * 100);
      const pctAcerto = 100 - pctErro;
      return { ...i, erros, pctErro, pctAcerto };
    });

  if (valid.length === 0) {
    return (
      <div className="text-center py-6">
        <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  // Ordena por dificuldade (maior % de erro primeiro; desempate por amostra).
  const porDificuldade = [...valid].sort((a, b) => b.pctErro - a.pctErro || b.total - a.total);
  const foco = porDificuldade.filter((i) => i.pctErro >= 40).slice(0, 3);
  const fortes = [...valid].sort((a, b) => b.pctAcerto - a.pctAcerto || b.total - a.total).slice(0, 2);

  return (
    <div className="space-y-4">
      {/* Destaques: onde focar x pontos fortes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-[11px] font-semibold flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" /> Priorize a revisão
          </p>
          {foco.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhuma {unidade} em nível crítico. Continue assim!</p>
          ) : (
            <ul className="space-y-1">
              {foco.map((i) => (
                <li key={i.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{i.name}</span>
                  <span className="font-bold text-destructive shrink-0">{i.pctErro}% erro</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-success/30 bg-success/5 p-3 space-y-2">
          <p className="text-[11px] font-semibold flex items-center gap-1.5 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pontos fortes
          </p>
          <ul className="space-y-1">
            {fortes.map((i) => (
              <li key={i.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{i.name}</span>
                <span className="font-bold text-success shrink-0">{i.pctAcerto}% acerto</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Ranking completo por % de erro */}
      <div className="space-y-2.5">
        {porDificuldade.map((i, idx) => {
          const tone = toneFor(i.pctAcerto);
          return (
            <motion.div
              key={i.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.4) }}
              className="space-y-1.5"
              title={`${i.erros} erros em ${i.total} questões`}
            >
              <div className="flex justify-between items-baseline text-xs gap-2">
                <span className="font-medium truncate flex items-center gap-1.5">
                  {idx === 0 && i.pctErro >= 40 && <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />}
                  {i.name}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{i.erros}/{i.total}</span>
                  <span className={`font-bold ${tone.text}`}>{i.pctErro}%</span>
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${i.pctErro}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" /> A barra indica o percentual de erro — quanto maior, mais essa {unidade} precisa de revisão.
      </p>
    </div>
  );
}
