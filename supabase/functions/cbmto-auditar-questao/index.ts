// Auditor editorial em 5 camadas — CHOA CBMTO 2026.
// Camadas: estrutural, normativa/técnica, editorial, psicométrica e ineditismo.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { runAiStage } from "../_shared/aiRouter.ts";
import { recuperarTrechosAutorizados } from "../_shared/cbmto-fontes.ts";
import {
  CRITERIOS_MATRIZ_CBMTO,
  DATA_CORTE_CBMTO,
  LETRAS_CBMTO,
  PROMPT_SISTEMA_CBMTO,
  auditarEscopoNormativo,
  auditarEstrutura,
  avaliarMatriz,
  decidirStatus,
  getEscopoDisciplina,
  type FalhaAuditoria,
} from "../_shared/escopo-cbmto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

function extrairJson(texto: string): any {
  const limpo = texto.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const bloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const alvo = (bloco ? bloco[1] : limpo).trim();
  const ini = alvo.indexOf("{");
  const fim = alvo.lastIndexOf("}");
  return JSON.parse(alvo.slice(ini, fim + 1));
}

function similaridade(a: string, b: string): number {
  const t = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^\wáéíóúâêôãõçà\s]/gi, " ").split(/\s+/).filter((w) => w.length > 3),
    );
  const A = t(a);
  const B = t(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Não autenticado" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json();
    const corrigir: boolean = body.corrigir === true;
    const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
    if (!ids.length) return json({ error: "Informe ao menos uma questão para auditar." }, 400);

    const { data: questoes } = await admin
      .from("cbmto_questoes_editoriais")
      .select("*")
      .in("id", ids);
    if (!questoes?.length) return json({ error: "Questões não encontradas." }, 404);

    const { data: fontesData } = await admin
      .from("cbmto_fontes_oficiais")
      .select("arquivo, conteudo, status")
      .eq("status", "validada");
    const fontes = new Map<string, any>();
    for (const f of (fontesData as any[]) ?? []) fontes.set(f.arquivo, f);
    const fontesValidadas = [...fontes.keys()];

    const resultados: any[] = [];

    for (const q of questoes as any[]) {
      const escopo = getEscopoDisciplina(q.disciplina);
      const falhas: FalhaAuditoria[] = [
        ...auditarEstrutura(q),
        ...auditarEscopoNormativo(q, fontesValidadas),
      ];

      // ── Camada 5 (determinística): ineditismo por similaridade ─────────────
      const { data: outras } = await admin
        .from("cbmto_questoes_editoriais")
        .select("id, enunciado")
        .eq("disciplina", q.disciplina)
        .neq("id", q.id)
        .limit(300);
      let colisao: { id: string; sim: number } | null = null;
      for (const o of ((outras as any[]) ?? [])) {
        const sim = similaridade(q.enunciado ?? "", o.enunciado ?? "");
        if (sim > 0.62 && (!colisao || sim > colisao.sim)) colisao = { id: o.id, sim };
      }
      if (colisao) {
        falhas.push({
          camada: "ineditismo",
          severidade: "eliminatoria",
          motivo: `Colisão material com a questão ${colisao.id} (similaridade ${(colisao.sim * 100).toFixed(0)}%).`,
          regra: "Item 9.5 — ineditismo material",
        });
      }

      // ── Camadas com IA: normativa/técnica, editorial e psicométrica ────────
      let ia: any = null;
      let iaErro: string | null = null;
      if (escopo && fontes.get(escopo.arquivo)?.conteudo) {
        const { texto } = recuperarTrechosAutorizados(String(fontes.get(escopo.arquivo).conteudo), escopo, {
          capitulo: q.capitulo ?? null,
          artigo: q.artigo ?? null,
          maxChars: 12000,
        });
        const prompt = `Audite a questão abaixo do CHOA CBMTO 2026.

RECORTE AUTORIZADO: ${escopo.observacao ?? "conforme matriz do edital"}
CAPÍTULOS AUTORIZADOS: ${escopo.capitulosAutorizados.join(", ") || "sem limitação capitular expressa"}
CAPÍTULOS EXCLUÍDOS: ${escopo.capitulosExcluidos.join(", ") || "nenhum"}
DATA DE CORTE: ${DATA_CORTE_CBMTO}

TRECHO AUTORIZADO DA FONTE (única base permitida):
"""
${texto}
"""

QUESTÃO:
Disciplina: ${q.disciplina}
Assunto: ${q.assunto ?? "—"}
Enunciado: ${q.enunciado}
A) ${q.alt_a}
B) ${q.alt_b}
C) ${q.alt_c}
D) ${q.alt_d}
Gabarito informado: ${LETRAS_CBMTO[q.gabarito] ?? "?"}
Comentário: ${q.comentario ?? "—"}
Análise das alternativas: ${q.analise_alternativas ?? "—"}
Base normativa: ${q.base_normativa ?? "—"}

Execute as camadas normativa/técnica, editorial e psicométrica e pontue os 11 critérios (true/false), nesta ordem:
${CRITERIOS_MATRIZ_CBMTO.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Responda SOMENTE com JSON:
{
  "criterios": [true/false x11],
  "respostas_defensaveis": número,
  "evidencia_insuficiente": boolean,
  "falhas": [{"camada":"normativa|editorial|psicometrica","severidade":"eliminatoria|alta|media|baixa","motivo":"...","trecho":"...","regra":"...","correcao_proposta":"..."}],
  "resumo": "string"${corrigir ? `,
  "correcao": { "enunciado":"...", "alt_a":"...", "alt_b":"...", "alt_c":"...", "alt_d":"...", "gabarito_letra":"A|B|C|D", "comentario":"...", "analise_alternativas":"...", "dica_prova":"...", "base_normativa":"..." },
  "correcao_suportada": boolean` : ""}
}
Só proponha correção quando houver suporte expresso no trecho fornecido; caso contrário, correcao_suportada=false.`;

        try {
          const res = await runAiStage(
            "legal_audit",
            [
              { role: "system", content: PROMPT_SISTEMA_CBMTO },
              { role: "user", content: prompt },
            ],
            { jsonResponse: true, maxOutputTokensOverride: 4096, complexity: "high", metadata: { modulo: "cbmto_auditoria" } },
          );
          ia = extrairJson(res.content);
        } catch (e) {
          iaErro = String(e).slice(0, 200);
        }
      } else {
        falhas.push({
          camada: "normativa",
          severidade: "eliminatoria",
          motivo: `Fonte "${escopo?.arquivo ?? "?"}" ausente ou não validada — auditoria normativa impossível.`,
          regra: "Item 4 — biblioteca e precedência das fontes",
        });
      }

      for (const f of (ia?.falhas ?? []) as any[]) {
        falhas.push({
          camada: (f.camada ?? "editorial") as FalhaAuditoria["camada"],
          severidade: (f.severidade ?? "media") as FalhaAuditoria["severidade"],
          motivo: String(f.motivo ?? "").slice(0, 500),
          trecho: f.trecho ? String(f.trecho).slice(0, 300) : undefined,
          regra: String(f.regra ?? "Auditoria CHOA CBMTO"),
        });
      }

      if ((ia?.respostas_defensaveis ?? 1) > 1) {
        falhas.push({
          camada: "psicometrica",
          severidade: "eliminatoria",
          motivo: `A IA identificou ${ia.respostas_defensaveis} respostas defensáveis.`,
          regra: "Item 1 — unicidade da resposta",
        });
      }

      // ── Matriz de 11 critérios ────────────────────────────────────────────
      const criteriosIa: boolean[] = Array.isArray(ia?.criterios) && ia.criterios.length === 11
        ? ia.criterios.map((c: any) => c === true)
        : new Array(11).fill(false);
      // Critérios determinísticos sobrescrevem a IA quando já reprovados aqui
      if (falhas.some((f) => f.camada === "normativa" && /escopo|recorte|Capítulo|Art\./i.test(f.motivo))) criteriosIa[4] = false;
      if (falhas.some((f) => /fonte|vigência|vigencia/i.test(f.motivo) && f.severidade === "eliminatoria")) criteriosIa[5] = false;
      if (falhas.some((f) => f.camada === "psicometrica" && f.severidade === "eliminatoria")) criteriosIa[8] = false;
      if (colisao) criteriosIa[10] = false;

      const matriz = avaliarMatriz(criteriosIa);
      let status = decidirStatus(falhas, matriz, {
        evidenciaInsuficiente: ia?.evidencia_insuficiente === true || (!!iaErro && falhas.length === 0),
      });

      // ── Correção assistida (apenas com suporte na fonte) + reauditoria ────
      const correcoes: any[] = [];
      if (corrigir && ia?.correcao && ia?.correcao_suportada === true) {
        const letra = String(ia.correcao.gabarito_letra ?? LETRAS_CBMTO[q.gabarito]).toUpperCase();
        const idx = LETRAS_CBMTO.indexOf(letra as any);
        const patch = {
          enunciado: ia.correcao.enunciado ?? q.enunciado,
          alt_a: ia.correcao.alt_a ?? q.alt_a,
          alt_b: ia.correcao.alt_b ?? q.alt_b,
          alt_c: ia.correcao.alt_c ?? q.alt_c,
          alt_d: ia.correcao.alt_d ?? q.alt_d,
          gabarito: idx >= 0 ? idx : q.gabarito,
          comentario: ia.correcao.comentario ?? q.comentario,
          analise_alternativas: ia.correcao.analise_alternativas ?? q.analise_alternativas,
          dica_prova: ia.correcao.dica_prova ?? q.dica_prova,
          base_normativa: ia.correcao.base_normativa ?? q.base_normativa,
        };
        correcoes.push(patch);
        Object.assign(q, patch);

        // Reauditoria completa das camadas determinísticas após a correção
        const falhasPos = [
          ...auditarEstrutura(q),
          ...auditarEscopoNormativo(q, fontesValidadas),
        ];
        falhas.length = 0;
        falhas.push(...falhasPos);
        if (colisao) {
          falhas.push({
            camada: "ineditismo",
            severidade: "eliminatoria",
            motivo: `Colisão material remanescente com a questão ${colisao.id}.`,
            regra: "Item 9.5 — ineditismo material",
          });
        }
        status = decidirStatus(falhas, matriz, {});
      } else if (corrigir && ia && ia.correcao_suportada !== true) {
        status = "quarentena";
        falhas.push({
          camada: "normativa",
          severidade: "eliminatoria",
          motivo: "Correção sem suporte expresso na fonte — questão enviada para quarentena.",
          regra: "Item 10 — política de correção",
        });
      }

      const relatorio = {
        estrutural: falhas.filter((f) => f.camada === "estrutural"),
        normativa: falhas.filter((f) => f.camada === "normativa"),
        editorial: falhas.filter((f) => f.camada === "editorial"),
        psicometrica: falhas.filter((f) => f.camada === "psicometrica"),
        ineditismo: falhas.filter((f) => f.camada === "ineditismo"),
        matriz,
        resumo_ia: ia?.resumo ?? null,
        erro_ia: iaErro,
        auditado_em: new Date().toISOString(),
      };

      const update: any = {
        status,
        criterios: criteriosIa,
        pontuacao: matriz.pontuacao,
        relatorio_auditoria: relatorio,
        revisado_por: user.id,
        revisado_em: new Date().toISOString(),
        ...(correcoes[0] ?? {}),
      };
      if (status === "aprovada") {
        update.aprovado_por = user.id;
        update.aprovado_em = new Date().toISOString();
      }

      await admin.from("cbmto_questoes_editoriais").update(update).eq("id", q.id);
      await admin.from("cbmto_auditoria_log").insert({
        questao_editorial_id: q.id,
        versao: q.versao ?? 1,
        camadas: relatorio,
        falhas,
        criterios: criteriosIa,
        pontuacao: matriz.pontuacao,
        status_resultante: status,
        correcoes,
        executado_por: user.id,
      });

      resultados.push({ id: q.id, disciplina: q.disciplina, status, pontuacao: matriz.pontuacao, falhas, matriz });
    }

    return json({ auditadas: resultados.length, resultados });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
