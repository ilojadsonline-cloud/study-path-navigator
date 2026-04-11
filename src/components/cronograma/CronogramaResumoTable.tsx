import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  AtividadeBloco, calcularResumo, formatMinutes, DISCIPLINAS, getCorDisciplina,
} from "@/lib/cronograma-generator";

interface Props {
  atividades: AtividadeBloco[];
}

export function CronogramaResumoTable({ atividades }: Props) {
  const { porDisciplina, totais } = calcularResumo(atividades);

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Disciplina</TableHead>
            <TableHead className="text-center">Videoaulas</TableHead>
            <TableHead className="text-center">Lei Seca</TableHead>
            <TableHead className="text-center">Questões</TableHead>
            <TableHead className="text-center font-bold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {DISCIPLINAS.map(d => (
            <TableRow key={d.nome}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.cor }} />
                  <span className="font-medium text-sm">{d.nome}</span>
                </div>
              </TableCell>
              <TableCell className="text-center text-sm">{formatMinutes(porDisciplina[d.nome]?.videoaula || 0)}</TableCell>
              <TableCell className="text-center text-sm">{formatMinutes(porDisciplina[d.nome]?.lei || 0)}</TableCell>
              <TableCell className="text-center text-sm">{formatMinutes(porDisciplina[d.nome]?.questoes || 0)}</TableCell>
              <TableCell className="text-center text-sm font-semibold">{formatMinutes(porDisciplina[d.nome]?.total || 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-bold">TOTAL</TableCell>
            <TableCell className="text-center font-bold">{formatMinutes(totais.videoaula)}</TableCell>
            <TableCell className="text-center font-bold">{formatMinutes(totais.lei)}</TableCell>
            <TableCell className="text-center font-bold">{formatMinutes(totais.questoes)}</TableCell>
            <TableCell className="text-center font-bold text-primary">{formatMinutes(totais.total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
