import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";

type LinkItem = {
  label: string;
  url: string;
  variant?: "default" | "secondary" | "outline";
};

type Section = {
  title: string;
  links: LinkItem[];
};

type Disciplina = {
  id: string;
  title: string;
  subtitle?: string;
  sections: Section[];
};

const disciplinas: Disciplina[] = [
  {
    id: "lei-2578",
    title: "Lei nº 2.578/2012 — Estatuto",
    subtitle: "Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins",
    sections: [
      {
        title: "📄 Textos Legais Oficiais",
        links: [
          { label: "AL-TO (PDF Oficial)", url: "https://www.al.to.leg.br/arquivos/lei_2578-2012_66938.PDF", variant: "default" },
          { label: "Governo do Tocantins (Portal)", url: "https://central3.to.gov.br/arquivo/269664/", variant: "outline" },
          { label: "Leis Estaduais (compilado)", url: "https://leisestaduais.com.br/to/lei-ordinaria-n-2578-2012-tocantins-dispoe-sobre-o-estatuto-dos-policiais-militares-e-bombeiros-militares-do-estado-do-tocantins-e-adota-outras-providencias", variant: "outline" },
          { label: "Lei 3.829/2021 (Alteração)", url: "https://leisestaduais.com.br/to/lei-ordinaria-n-3829-2021-tocantins-altera-a-lei-no-2-575-de-20-de-abril-de-2012", variant: "outline" },
          { label: "Lei 4.167/2023 (Alteração)", url: "https://leisestaduais.com.br/to/lei-ordinaria-n-4167-2023-tocantins-altera-a-lei-n-2578-de-20-de-abril-de-2012", variant: "outline" },
        ],
      },
      {
        title: "🎥 Videoaulas",
        links: [
          { label: "Lei 2.578 em Áudio", url: "https://www.youtube.com/watch?v=M6BBI1WBjlY", variant: "secondary" },
          { label: "Hierarquia e Disciplina (PMTO)", url: "https://www.youtube.com/watch?v=KOA5SmHMwiw", variant: "secondary" },
          { label: "Normas PMTO — Hierarquia e Disciplina", url: "https://www.youtube.com/watch?v=Wjnme_CJwp4", variant: "secondary" },
          { label: "Lei 2.578 em Questões", url: "https://www.youtube.com/watch?v=SXlDt872rA4", variant: "secondary" },
          { label: "Monster Concursos — Estatuto PMTO", url: "https://www.youtube.com/watch?v=Rb0J_0QNW1Q", variant: "secondary" },
          { label: "Demissão de Militar — PMTO", url: "https://www.youtube.com/watch?v=Wjnme_CJwp4", variant: "secondary" },
        ],
      },
      {
        title: "📚 Apostilas e Materiais",
        links: [
          { label: "Prof. Junior Geo — Estatuto PM/BM TO (PDF)", url: "https://professorjuniorgeo.com.br/portal/wp-content/uploads/2021/04/Lei-Estadual-n%C2%B0-2.578-Estatuto-dos-Policiais-Militares-e-Bombeiros-Militares-do-Estado-do-Tocantins.pdf", variant: "default" },
          { label: "Prof. Junior Geo — Legislação PM-TO Completa (PDF)", url: "https://professorjuniorgeo.com.br/portal/wp-content/uploads/2021/02/LEGISLAC%CC%A7A%CC%83O-PM-TO.pdf", variant: "default" },
        ],
      },
      {
        title: "❓ Questões",
        links: [
          { label: "Questões (YouTube)", url: "https://www.youtube.com/watch?v=_5em8-koiws", variant: "outline" },
          { label: "15 Questões — Estatuto PMTO", url: "https://www.youtube.com/watch?v=43Ql4h1nqkw", variant: "outline" },
          { label: "QConcursos — Questões PM-TO", url: "https://www.qconcursos.com/questoes-militares/questoes?institute_ids%5B%5D=6288", variant: "outline" },
          { label: "Gran Questões — PM-TO Legislação", url: "https://questoes.grancursosonline.com.br/questoes-de-concursos/legislacao-dos-orgaos-policia-militar-do-estado-do-tocantins-pm-to-401468", variant: "outline" },
          { label: "Questões de Legislação — PM-TO", url: "https://questoesdelegislacao.com.br/concursos/pm-to/", variant: "outline" },
        ],
      },
    ],
  },
  {
    id: "lc-128",
    title: "Lei Complementar nº 128/2021 — Organização Básica",
    subtitle: "Organização Básica da Polícia Militar do Estado do Tocantins — PMTO",
    sections: [
      {
        title: "📄 Textos Legais Oficiais",
        links: [
          { label: "AL-TO (PDF Oficial)", url: "https://www.al.to.leg.br/arquivos/lei_128-2021_66731.PDF", variant: "default" },
          { label: "ASMIR (PDF)", url: "https://asmir.org.br/wp-content/uploads/2022/04/LEI-COMPLEMENTAR-No-128-de-14-de-Abril-de-2021-Que-Dispoe-sobre-a-Organizacao-Basica-da-Policia-Militar-do-Estado-do-Tocantis.pdf", variant: "default" },
          { label: "Leis Estaduais (compilado)", url: "https://leisestaduais.com.br/to/lei-complementar-n-128-2021-tocantins-dispoe-sobre-a-organizacao-basica-da-policia-militar-do-estado-do-tocantins-pmto-e-adota-outras-providencias", variant: "outline" },
        ],
      },
      {
        title: "🎥 Videoaulas",
        links: [
          { label: "LC 128/2021 — Organização Básica", url: "https://www.youtube.com/watch?v=3A9pGFTdMDw", variant: "secondary" },
          { label: "Aula 01 — LC 128/21", url: "https://www.youtube.com/watch?v=XFnc_jY4Q04", variant: "secondary" },
          { label: "Shorts — LC 128/21", url: "https://www.youtube.com/shorts/1xLScKe8-tg", variant: "secondary" },
        ],
      },
      {
        title: "❓ Questões",
        links: [
          { label: "10 Questões — LC 128/2021 (YouTube)", url: "https://www.youtube.com/watch?v=_m3fK637cz8", variant: "outline" },
          { label: "Gran Questões — PM-TO Legislação", url: "https://questoes.grancursosonline.com.br/questoes-de-concursos/legislacao-dos-orgaos-policia-militar-do-estado-do-tocantins-pm-to-401468", variant: "outline" },
          { label: "QConcursos — Questões PM-TO", url: "https://www.qconcursos.com/questoes-militares/questoes?institute_ids%5B%5D=6288", variant: "outline" },
        ],
      },
    ],
  },
  {
    id: "lei-2575",
    title: "Lei nº 2.575/2012 — Promoções",
    subtitle: "Promoções na Polícia Militar do Estado do Tocantins — PMTO",
    sections: [
      {
        title: "📄 Textos Legais Oficiais",
        links: [
          { label: "AL-TO (PDF Oficial)", url: "https://www.al.to.leg.br/arquivos/lei_2575-2012_66937.PDF", variant: "default" },
          { label: "Governo do Tocantins (Portal)", url: "https://central3.to.gov.br/arquivo/269663/", variant: "outline" },
          { label: "Leis Estaduais (compilado)", url: "https://leisestaduais.com.br/to/lei-ordinaria-n-2575-2012-tocantins-dispoe-sobre-as-promocoes-da-policia-militar-do-estado-do-tocantins-pmto-e-adota-outras-providencias", variant: "outline" },
          { label: "Lei 3.829/2021 (Alteração)", url: "https://leisestaduais.com.br/to/lei-ordinaria-n-3829-2021-tocantins-altera-a-lei-no-2-575-de-20-de-abril-de-2012", variant: "outline" },
        ],
      },
      {
        title: "🎥 Videoaulas",
        links: [
          { label: "Lei de Promoções PMTO — Aula Completa", url: "https://www.youtube.com/watch?v=FVQhXvPqKmE", variant: "secondary" },
          { label: "Lei 2.575/2012 em Questões", url: "https://www.youtube.com/watch?v=Ky_mJ5vR8Ks", variant: "secondary" },
        ],
      },
      {
        title: "📚 Apostilas",
        links: [
          { label: "Prof. Junior Geo — Lei de Promoções PMTO (PDF)", url: "https://professorjuniorgeo.com.br/portal/wp-content/uploads/2021/04/Lei-n%C2%B0-2.575-Promocoes-PMTO.pdf", variant: "default" },
        ],
      },
      {
        title: "❓ Questões",
        links: [
          { label: "QConcursos — Questões PM-TO", url: "https://www.qconcursos.com/questoes-militares/questoes?institute_ids%5B%5D=6288", variant: "outline" },
          { label: "Gran Questões — PM-TO Legislação", url: "https://questoes.grancursosonline.com.br/questoes-de-concursos/legislacao-dos-orgaos-policia-militar-do-estado-do-tocantins-pm-to-401468", variant: "outline" },
        ],
      },
    ],
  },
  {
    id: "cppm",
    title: "CPPM — Artigos Selecionados",
    subtitle: "Arts. 8º ao 28º e Arts. 243º ao 253º",
    sections: [
      {
        title: "📄 Textos Legais Oficiais",
        links: [
          { label: "CPPM — Texto Completo (Planalto)", url: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm", variant: "default" },
          { label: "CPPM — Arts. 8–28 (link direto)", url: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm#art8", variant: "outline" },
          { label: "CPPM — Arts. 243–253 (link direto)", url: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm#art243", variant: "outline" },
          { label: "CPPM — Versão comentada (Conjur PDF)", url: "https://www.conjur.com.br/dl/codigo-processo-penal-militar.pdf", variant: "outline" },
        ],
      },
      {
        title: "🎥 Videoaulas",
        links: [
          { label: "Competência da Polícia Judiciária Militar", url: "https://www.youtube.com/watch?v=8vQpKmL_Zw0", variant: "secondary" },
          { label: "IPM (Inquérito Policial Militar)", url: "https://www.youtube.com/watch?v=Ky_mJ5vR8Ks", variant: "secondary" },
          { label: "Prisão em Flagrante Delito", url: "https://www.youtube.com/watch?v=VqX_5pL_Zk8", variant: "secondary" },
          { label: "CPPM em Questões (PMTO)", url: "https://www.youtube.com/watch?v=3vN_8kL_Qw0", variant: "secondary" },
        ],
      },
      {
        title: "📚 Apostilas",
        links: [
          { label: "Resumo Executivo (Conjur PDF)", url: "https://www.conjur.com.br/dl/resumo-cppm.pdf", variant: "default" },
          { label: "QConcursos — Materiais (CPPM)", url: "https://www.qconcursos.com/materiais-de-estudo/cppm-artigos-importantes", variant: "outline" },
        ],
      },
      {
        title: "❓ Questões",
        links: [
          { label: "QConcursos — CPPM", url: "https://www.qconcursos.com/questoes-militares/questoes?subject_ids%5B%5D=1234", variant: "outline" },
          { label: "Gran Questões — CPPM", url: "https://questoes.grancursosonline.com.br/questoes-de-concursos/codigo-de-processo-penal-militar-cppm", variant: "outline" },
          { label: "SimuladosBR — Simulado CPPM", url: "https://www.simuladosbr.net/simulado-cppm/", variant: "outline" },
        ],
      },
    ],
  },
  {
    id: "rdmeto",
    title: "Decreto nº 4.994/2014 — RDMETO",
    subtitle: "Regulamento Disciplinar Militar do Estado do Tocantins",
    sections: [
      {
        title: "📄 Textos Legais Oficiais",
        links: [
          { label: "AL-TO (PDF Oficial)", url: "https://www.al.to.leg.br/arquivos/decreto_4994-2014_66936.PDF", variant: "default" },
          { label: "Governo do Tocantins (Portal)", url: "https://central3.to.gov.br/arquivo/269662/", variant: "outline" },
          { label: "Leis Estaduais (compilado)", url: "https://leisestaduais.com.br/to/decreto-n-4994-2014-tocantins-aprova-o-regulamento-disciplinar-militar-do-estado-do-tocantins-rdmeto", variant: "outline" },
        ],
      },
      {
        title: "🎥 Videoaulas",
        links: [
          { label: "RDMETO — Regulamento Disciplinar", url: "https://www.youtube.com/watch?v=Wjnme_CJwp4", variant: "secondary" },
          { label: "RDMETO em Questões", url: "https://www.youtube.com/watch?v=SXlDt872rA4", variant: "secondary" },
          { label: "Infrações Disciplinares — RDMETO", url: "https://www.youtube.com/watch?v=Ky_mJ5vR8Ks", variant: "secondary" },
        ],
      },
      {
        title: "📚 Apostilas",
        links: [
          { label: "Prof. Junior Geo — RDMETO Resumo (PDF)", url: "https://professorjuniorgeo.com.br/portal/wp-content/uploads/2021/04/RDMETO-Resumo.pdf", variant: "default" },
        ],
      },
      {
        title: "❓ Questões",
        links: [
          { label: "QConcursos — RDMETO/PM-TO", url: "https://www.qconcursos.com/questoes-militares/questoes?institute_ids%5B%5D=6288", variant: "outline" },
          { label: "Gran Questões — RDMETO", url: "https://questoes.grancursosonline.com.br/questoes-de-concursos/regulamento-disciplinar-militar", variant: "outline" },
          { label: "SimuladosBR — Simulado RDMETO", url: "https://www.simuladosbr.net/simulado-rdmeto/", variant: "outline" },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: "Extras — Plataformas e Portais",
    subtitle: "Atalhos úteis para complementar os estudos",
    sections: [
      {
        title: "🧩 Plataformas de Questões",
        links: [
          { label: "QConcursos", url: "https://www.qconcursos.com/", variant: "default" },
          { label: "Gran Cursos", url: "https://www.grancursosonline.com.br/", variant: "default" },
          { label: "Simulados BR", url: "https://www.simuladosbr.net/", variant: "outline" },
          { label: "Questões de Legislação", url: "https://questoesdelegislacao.com.br/", variant: "outline" },
          { label: "Estratégia Concursos", url: "https://www.estrategiaconcursos.com.br/", variant: "outline" },
          { label: "Alfacon", url: "https://www.alfacon.com.br/", variant: "outline" },
        ],
      },
      {
        title: "📺 Canais YouTube",
        links: [
          { label: "Monster Concursos", url: "https://www.youtube.com/c/MonsterConcursos", variant: "secondary" },
          { label: "Professor Junior Geo", url: "https://www.youtube.com/c/ProfessorJuniorGeo", variant: "secondary" },
          { label: "Estratégia Concursos", url: "https://www.youtube.com/c/EstrategiaConc", variant: "secondary" },
          { label: "Gran Cursos Online", url: "https://www.youtube.com/c/GranCursosOnline", variant: "secondary" },
          { label: "Alfacon", url: "https://www.youtube.com/c/Alfacon", variant: "secondary" },
          { label: "Concursos Militares Brasil", url: "https://www.youtube.com/c/ConcursosMilitaresBrasil", variant: "secondary" },
        ],
      },
      {
        title: "🏛️ Portais Oficiais",
        links: [
          { label: "AL-TO", url: "https://www.al.to.leg.br/", variant: "default" },
          { label: "Governo do Tocantins (Central3)", url: "https://central3.to.gov.br/", variant: "default" },
          { label: "PMTO", url: "https://www.pm.to.gov.br/", variant: "outline" },
          { label: "Planalto", url: "https://www.planalto.gov.br/", variant: "outline" },
          { label: "Senado", url: "https://www2.senado.leg.br/", variant: "outline" },
          { label: "Leis Estaduais (TO)", url: "https://leisestaduais.com.br/to/", variant: "outline" },
          { label: "Jusbrasil", url: "https://www.jusbrasil.com.br/", variant: "outline" },
          { label: "Conjur", url: "https://www.conjur.com.br/", variant: "outline" },
        ],
      },
      {
        title: "📱 Apps (Android)",
        links: [
          { label: "QConcursos Mobile", url: "https://play.google.com/store/apps/details?id=com.qconcursos.mobile", variant: "outline" },
          { label: "Gran Cursos Mobile", url: "https://play.google.com/store/apps/details?id=br.com.grancursos.mobile", variant: "outline" },
          { label: "Simulados BR Mobile", url: "https://play.google.com/store/apps/details?id=com.simuladosbr.mobile", variant: "outline" },
        ],
      },
    ],
  },
];

function ExternalLinkButton({ item }: { item: LinkItem }) {
  const variant = item.variant ?? "outline";
  return (
    <Button asChild variant={variant} className="h-9">
      <a href={item.url} target="_blank" rel="noreferrer">
        {item.label}
      </a>
    </Button>
  );
}

export default function Edital() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-gradient-primary">📚 Edital Verticalizado</h1>
          <p className="text-sm text-muted-foreground">
            Trilhas por disciplina com links oficiais, videoaulas e questões (PMTO/TO).
          </p>
        </header>

        <div className="space-y-6">
          {disciplinas.map((d) => (
            <Card key={d.id} className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{d.title}</CardTitle>
                {d.subtitle ? (
                  <p className="text-sm text-muted-foreground">{d.subtitle}</p>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-5">
                {d.sections.map((s) => (
                  <div key={s.title} className="space-y-2">
                    <h3 className="font-semibold">{s.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {s.links.map((item) => (
                        <ExternalLinkButton key={`${s.title}-${item.url}`} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
