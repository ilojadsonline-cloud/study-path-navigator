import { describe, it, expect } from "vitest";
import {
  gerarCronogramaPadrao,
  calcularResumo,
  getDisciplinasCronograma,
  getDistribuicaoPadrao,
} from "@/lib/cronograma-generator";

describe("cronograma CBMTO", () => {
  const cron = gerarCronogramaPadrao("cbmto");
  const resumo = calcularResumo(cron.atividades, "cbmto");

  it("usa 0% videoaula / 50% lei / 50% questões", () => {
    expect(getDistribuicaoPadrao("cbmto")).toEqual({ videoaulas: 0, lei: 50, questoes: 50 });
    expect(cron.distribuicao).toEqual({ videoaulas: 0, lei: 50, questoes: 50 });
  });

  it("totaliza 20 horas sem blocos de videoaula", () => {
    expect(resumo.totais.total).toBe(20 * 60);
    expect(resumo.totais.videoaula).toBe(0);
    expect(resumo.totais.lei).toBe(10 * 60);
    expect(resumo.totais.questoes).toBe(10 * 60);
  });

  it("contempla as 14 disciplinas do edital", () => {
    const usadas = new Set(cron.atividades.map((a) => a.disciplina));
    const todas = getDisciplinasCronograma("cbmto");
    expect(todas).toHaveLength(14);
    todas.forEach((d) => expect(usadas.has(d.nome)).toBe(true));
    [
      "Lei nº 2.578/2012 — Estatuto dos Militares do TO",
      "LC nº 131/2021 — Organização Básica do CBMTO",
      "Lei nº 2.665/2012 — Promoções no CBMTO",
      "Lei nº 3.798/2021 — Segurança Contra Incêndio",
    ].forEach((nome) => expect(usadas.has(nome)).toBe(true));
  });
});

describe("cronograma PMTO", () => {
  it("mantém 40/30/30", () => {
    expect(getDistribuicaoPadrao("pmto")).toEqual({ videoaulas: 40, lei: 30, questoes: 30 });
    const cron = gerarCronogramaPadrao("pmto");
    expect(cron.distribuicao).toEqual({ videoaulas: 40, lei: 30, questoes: 30 });
    const resumo = calcularResumo(cron.atividades, "pmto");
    expect(resumo.totais.total).toBe(20 * 60);
    expect(resumo.totais.videoaula).toBe(8 * 60);
    expect(resumo.totais.lei).toBe(6 * 60);
    expect(resumo.totais.questoes).toBe(6 * 60);
  });
});
