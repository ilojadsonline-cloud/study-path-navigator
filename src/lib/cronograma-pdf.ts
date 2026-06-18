import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  CronogramaData,
  AtividadeBloco,
  DIAS_SEMANA_ORDER,
  getDiaLabel,
  getCorDisciplina,
  calcularResumo,
  formatMinutes,
  DISCIPLINAS,
  TIPO_LABELS,
} from "./cronograma-generator";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

export function exportCronogramaPDF(cronograma: CronogramaData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Método CHOA 2026", marginX, 16);

  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text(cronograma.nome, marginX, 24);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  const subtitle = `${cronograma.horas_semanais}h semanais • ${cronograma.dias_semana.length} dias • Horário: ${cronograma.horario_inicio} às ${cronograma.horario_fim}`;
  doc.text(subtitle, marginX, 30);

  // Build weekly grid table
  const orderedDias = DIAS_SEMANA_ORDER.filter((d) => cronograma.dias_semana.includes(d));

  const atividadesPorDia: Record<string, AtividadeBloco[]> = {};
  orderedDias.forEach((d) => (atividadesPorDia[d] = []));
  cronograma.atividades.forEach((a) => {
    if (atividadesPorDia[a.dia_semana]) atividadesPorDia[a.dia_semana].push(a);
  });
  Object.values(atividadesPorDia).forEach((arr) =>
    arr.sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio))
  );

  const maxBlocks = Math.max(1, ...Object.values(atividadesPorDia).map((a) => a.length));

  const head = [orderedDias.map((d) => getDiaLabel(d))];
  const body: string[][] = [];
  for (let i = 0; i < maxBlocks; i++) {
    body.push(
      orderedDias.map((dia) => {
        const b = atividadesPorDia[dia]?.[i];
        if (!b) return "";
        return `${b.horario_inicio} - ${b.horario_fim}\n${b.disciplina}\n${TIPO_LABELS[b.tipo_atividade]}`;
      })
    );
  }

  autoTable(doc, {
    head,
    body,
    startY: 36,
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      valign: "top",
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 30, 35],
      textColor: [255, 255, 255],
      halign: "center",
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: orderedDias.reduce((acc, _, idx) => {
      acc[idx] = { cellWidth: (pageWidth - marginX * 2) / orderedDias.length };
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    didParseCell: (data) => {
      if (data.section === "body") {
        const dia = orderedDias[data.column.index];
        const b = atividadesPorDia[dia]?.[data.row.index];
        if (b) {
          const [r, g, bl] = hexToRgb(getCorDisciplina(b.disciplina));
          data.cell.styles.fillColor = [
            Math.round(r + (255 - r) * 0.85),
            Math.round(g + (255 - g) * 0.85),
            Math.round(bl + (255 - bl) * 0.85),
          ];
        }
      }
    },
  });

  // Summary table
  const { porDisciplina, totais } = calcularResumo(cronograma.atividades);
  const finalY = (doc as any).lastAutoTable?.finalY || 36;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Resumo de Horas por Disciplina", marginX, finalY + 10);

  autoTable(doc, {
    startY: finalY + 13,
    margin: { left: marginX, right: marginX },
    head: [["Disciplina", "Videoaulas", "Lei Seca", "Questões", "Total"]],
    body: DISCIPLINAS.map((d) => [
      d.nome,
      formatMinutes(porDisciplina[d.nome]?.videoaula || 0),
      formatMinutes(porDisciplina[d.nome]?.lei || 0),
      formatMinutes(porDisciplina[d.nome]?.questoes || 0),
      formatMinutes(porDisciplina[d.nome]?.total || 0),
    ]),
    foot: [[
      "TOTAL",
      formatMinutes(totais.videoaula),
      formatMinutes(totais.lei),
      formatMinutes(totais.questoes),
      formatMinutes(totais.total),
    ]],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 30, 35], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [245, 245, 245], textColor: [20, 20, 20], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center", fontStyle: "bold" },
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")} • metodochoa.com.br`,
      marginX,
      doc.internal.pageSize.getHeight() - 6
    );
  }

  const safeName = cronograma.nome.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
  doc.save(`cronograma-${safeName || "estudos"}.pdf`);
}
