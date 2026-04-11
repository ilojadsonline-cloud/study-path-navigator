import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { CronogramaData, DIAS_SEMANA_ORDER, getDiaLabel, gerarCronograma } from "@/lib/cronograma-generator";
import { ArrowLeft, Sparkles } from "lucide-react";

interface Props {
  onGenerate: (cronograma: CronogramaData) => void;
  onBack: () => void;
}

export function GeradorPersonalizado({ onGenerate, onBack }: Props) {
  const [horas, setHoras] = useState(20);
  const [videoaulas, setVideoaulas] = useState(40);
  const [lei, setLei] = useState(30);
  const [questoes, setQuestoes] = useState(30);
  const [dias, setDias] = useState<string[]>(["segunda", "terca", "quarta", "quinta", "sexta"]);
  const [horarioInicio, setHorarioInicio] = useState("19:00");
  const [horarioFim, setHorarioFim] = useState("23:00");
  const [nome, setNome] = useState("");

  const somaTotal = videoaulas + lei + questoes;
  const isDistribuicaoValida = somaTotal === 100;

  const toggleDia = (dia: string) => {
    setDias(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const handleGenerate = () => {
    const params = {
      horas_semanais: horas,
      distribuicao: { videoaulas, lei, questoes },
      dias_semana: dias,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
    };

    onGenerate({
      nome: nome || `Cronograma Personalizado (${horas}h)`,
      tipo: "personalizado",
      ...params,
      atividades: gerarCronograma(params),
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <h2 className="text-xl font-bold">Cronograma Personalizado</h2>
      </div>

      {/* Step 1 */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Disponibilidade de Tempo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Horas semanais: <span className="font-bold text-primary">{horas}h</span></Label>
            <Slider value={[horas]} onValueChange={v => setHoras(v[0])} min={5} max={40} step={1} className="mt-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>5h</span><span>40h</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader><CardTitle className="text-base">2. Distribuição por Tipo de Atividade</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Videoaulas: <span className="font-bold">{videoaulas}%</span></Label>
            <Slider value={[videoaulas]} onValueChange={v => setVideoaulas(v[0])} min={0} max={100} step={5} className="mt-2" />
          </div>
          <div>
            <Label>Leitura de Lei: <span className="font-bold">{lei}%</span></Label>
            <Slider value={[lei]} onValueChange={v => setLei(v[0])} min={0} max={100} step={5} className="mt-2" />
          </div>
          <div>
            <Label>Questões: <span className="font-bold">{questoes}%</span></Label>
            <Slider value={[questoes]} onValueChange={v => setQuestoes(v[0])} min={0} max={100} step={5} className="mt-2" />
          </div>
          <div className={`text-sm font-medium ${isDistribuicaoValida ? 'text-success' : 'text-destructive'}`}>
            Total: {somaTotal}% {isDistribuicaoValida ? "✓" : "(deve somar 100%)"}
          </div>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card>
        <CardHeader><CardTitle className="text-base">3. Dias e Horários</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Dias disponíveis:</Label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA_ORDER.map(dia => (
                <label key={dia} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={dias.includes(dia)} onCheckedChange={() => toggleDia(dia)} />
                  <span className="text-sm">{getDiaLabel(dia)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Horário de início</Label>
              <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
            </div>
            <div>
              <Label>Horário de fim</Label>
              <Input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Nome do cronograma (opcional)</Label>
            <Input placeholder="ex: Cronograma Semana 1" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleGenerate} disabled={dias.length === 0 || !isDistribuicaoValida}>
          <Sparkles className="w-4 h-4 mr-1" /> Gerar Cronograma
        </Button>
      </div>
    </motion.div>
  );
}
