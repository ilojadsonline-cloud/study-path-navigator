// Gerador editorial de questões — CHOA CBMTO 2026.
// Trabalha exclusivamente com fontes locais autorizadas e com a matriz do edital.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { runAiStage } from "../_shared/aiRouter.ts";
import { recuperarTrechosAutorizados } from "../_shared/cbmto-fontes.ts";
import {
  ANO_CBMTO,
  BANCA_CBMTO,
  COTAS_OFICIAIS_CBMTO,
  DATA_CORTE_CBMTO,
  DIFICULDADE_CBMTO,
  LETRAS_CBMTO,
  PROMPT_SISTEMA_CBMTO,
  PROVA_CBMTO,
  TOTAL_QUESTOES_SIMULADO_CBMTO,
  auditarEscopoNormativo,
  auditarEstrutura,
  estrategiaDisciplina,
  getEscopoDisciplina,
  planejarGabaritos,
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
  const inicio = alvo.indexOf("[") >= 0 && (alvo.indexOf("[") < alvo.indexOf("{") || alvo.indexOf("{") < 0)
    ? alvo.indexOf("[")
    : alvo.indexOf("{");
  const fim = Math.max(alvo.lastIndexOf("]"), alvo.lastIndexOf("}"));
  return JSON.parse(alvo.slice(inicio, fim + 1));
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
    const cursoId: string | null = body.curso_id ?? null;
    const modo: string = body.modo ?? "lote"; // individual | lote | disciplina | simulado_oficial
    const observacoes: string = (body.observacoes ?? "").slice(0, 800);
    const assunto: string | null = body.assunto ?? null;
    const formato: string | null = body.formato ?? null;
    const compararBanco: boolean = body.comparar_banco !== false;
    const seed = Number(body.seed ?? Date.now() % 100000);

    // ── Plano de itens (disciplina + letra planejada) ─────────────────────────
    const plano: { disciplina: string; letra: string }[] = [];
    if (modo === "simulado_oficial") {
      const letras = planejarGabaritos(TOTAL_QUESTOES_SIMULADO_CBMTO, {
        oficial: true,
        seed,
        indiceSimulado: Number(body.indice_simulado ?? 0),
      });
      const discs: string[] = [];
      for (const cota of COTAS_OFICIAIS_CBMTO) {
        for (let i = 0; i < cota.questoes; i++) {
          discs.push(cota.disciplinas[i % cota.disciplinas.length]); // divisão apenas pedagógica
        }
      }
      discs.forEach((d, i) => plano.push({ disciplina: d, letra: letras[i] }));
    } else {
      const disciplina: string = body.disciplina;
      if (!disciplina) return json({ error: "Informe a disciplina." }, 400);
      const quantidade = Math.max(1, Math.min(10, Number(body.quantidade ?? (modo === "individual" ? 1 : 3))));
      const letras = planejarGabaritos(quantidade, { seed });
      for (let i = 0; i < quantidade; i++) plano.push({ disciplina, letra: letras[i] });
    }

    // ── Fontes obrigatórias validadas ────────────────────────────────────────
    const disciplinasAlvo = [...new Set(plano.map((p) => p.disciplina))];
    const { data: fontes } = await admin
      .from("cbmto_fontes_oficiais")
      .select("arquivo, disciplina, conteudo, status, versao, data_documento")
      .eq("status", "validada");
    const fontesPorArquivo = new Map<string, any>();
    for (const f of (fontes as any[]) ?? []) fontesPorArquivo.set(f.arquivo, f);

    const faltando: string[] = [];
    for (const d of disciplinasAlvo) {
      const escopo = getEscopoDisciplina(d);
      if (!escopo) return json({ error: `Disciplina fora do edital CBMTO: ${d}` }, 400);
      const fonte = fontesPorArquivo.get(escopo.arquivo);
      if (!fonte || !fonte.conteudo || !String(fonte.conteudo).trim()) faltando.push(escopo.arquivo);
    }
    if (faltando.length) {
      return json(
        {
          error: "FONTE_OBRIGATORIA_AUSENTE",
          mensagem: `Geração bloqueada: cadastre e valide a(s) fonte(s) ${[...new Set(faltando)].join(", ")} na aba "Fontes oficiais".`,
          fontes_faltantes: [...new Set(faltando)],
        },
        422,
      );
    }

    const loteId = crypto.randomUUID();
    const geradas: any[] = [];
    const descartadas: { disciplina: string; motivo: string }[] = [];

    // Assinaturas do banco existente (ineditismo)
    let assinaturas: string[] = [];
    if (compararBanco) {
      const { data: banco } = await admin
        .from("cbmto_questoes_editoriais")
        .select("enunciado")
        .in("disciplina", disciplinasAlvo)
        .order("created_at", { ascending: false })
        .limit(200);
      assinaturas = ((banco as any[]) ?? []).map((q) => String(q.enunciado).slice(0, 160));
    }

    for (let i = 0; i < plano.length; i++) {
      const item = plano[i];
      const escopo = getEscopoDisciplina(item.disciplina)!;
      const fonte = fontesPorArquivo.get(escopo.arquivo);
      const { texto, capitulosUsados, artigosUsados } = recuperarTrechosAutorizados(
        String(fonte.conteudo),
        escopo,
        { capitulo: body.capitulo ?? null, artigo: body.artigo ?? null, seed: seed + i, maxChars: 12000 },
      );

      if (!texto.trim()) {
        descartadas.push({ disciplina: item.disciplina, motivo: "Nenhum trecho autorizado disponível na fonte." });
        continue;
      }

      const prompt = `DISCIPLINA: ${item.disciplina}
ARQUIVO-FONTE AUTORIZADO: ${escopo.arquivo}
EDITAL AUTORIZADOR: ${escopo.editalAutorizador}
RECORTE AUTORIZADO: ${escopo.observacao ?? "conforme matriz do edital"}
CAPÍTULOS AUTORIZADOS: ${escopo.capitulosAutorizados.join(", ") || "sem limitação capitular expressa"}
CAPÍTULOS EXCLUÍDOS (proibidos): ${escopo.capitulosExcluidos.join(", ") || "nenhum"}
ARTIGOS AUTORIZADOS: ${escopo.artigosAutorizados.map((f) => `${f.de}–${f.ate}`).join("; ") || "sem recorte por artigo"}
DATA DE CORTE DE VIGÊNCIA: ${DATA_CORTE_CBMTO}
DIFICULDADE OBRIGATÓRIA: ${DIFICULDADE_CBMTO}
BANCA: ${BANCA_CBMTO} | ANO: ${ANO_CBMTO} | PROVA: ${PROVA_CBMTO}
LETRA DO GABARITO PLANEJADA (obrigatória): ${item.letra}
FORMATO PREDOMINANTE: ${formato ?? "variar entre caso prático, sequência operacional, julgamento de assertivas, alternativa INCORRETA, comparação técnica e literalidade qualificada"}
ASSUNTO SUGERIDO: ${assunto ?? "escolher subtópico autorizado ainda pouco explorado"}
OBSERVAÇÕES EDITORIAIS: ${observacoes || "—"}
ESTRATÉGIA DA DISCIPLINA: ${estrategiaDisciplina(item.disciplina)}

ENUNCIADOS JÁ EXISTENTES (evite colisão material):
${assinaturas.slice(0, 40).map((a, n) => `${n + 1}. ${a}`).join("\n") || "(banco vazio)"}

TRECHO AUTORIZADO DA FONTE (única base permitida):
"""
${texto}
"""

Antes de redigir, planeje internamente: dispositivo, evidência de inclusão no edital, operação cognitiva, hipótese concorrente e a diferença material em relação ao banco.

Responda SOMENTE com JSON válido:
{
  "status": "ok" | "quarentena",
  "motivo_quarentena": "string (só quando status=quarentena)",
  "assunto": "string",
  "enunciado": "string",
  "alt_a": "string", "alt_b": "string", "alt_c": "string", "alt_d": "string",
  "gabarito_letra": "${item.letra}",
  "comentario": "explica por que o gabarito resolve o caso, ligando os fatos decisivos à regra/técnica",
  "analise_alternativas": "A) Correta/Incorreta — motivo; B) ...; C) ...; D) ...",
  "dica_prova": "string",
  "base_normativa": "arquivo local + capítulo/artigo/dispositivo + subtópico (nunca URL)",
  "arquivo_fonte": "${escopo.arquivo}",
  "capitulo": número ou null,
  "artigo": número ou null,
  "dispositivo": "string",
  "subtopico": "string",
  "formato": "string",
  "operacao_cognitiva": "string",
  "hipotese_concorrente": "string",
  "logica_distratores": { "A": "erro controlado", "B": "...", "C": "...", "D": "..." },
  "evidencias": ["trecho literal da fonte que comprova a alternativa correta"]
}`;

      let parsed: any;
      try {
        const res = await runAiStage(
          "question_generation",
          [
            { role: "system", content: PROMPT_SISTEMA_CBMTO },
            { role: "user", content: prompt },
          ],
          { jsonResponse: true, maxTokens: 4096, metadata: { modulo: "cbmto", lote: loteId } },
        );
        parsed = extrairJson(res.content);
      } catch (e) {
        descartadas.push({ disciplina: item.disciplina, motivo: `Falha na IA: ${String(e).slice(0, 160)}` });
        continue;
      }

      const letraIdx = LETRAS_CBMTO.indexOf(String(parsed.gabarito_letra ?? item.letra).toUpperCase() as any);
      const registro = {
        curso_id: cursoId,
        lote_id: loteId,
        lote_tipo: modo,
        ordem: i + 1,
        disciplina: item.disciplina,
        assunto: parsed.assunto ?? assunto,
        enunciado: parsed.enunciado ?? "",
        alt_a: parsed.alt_a ?? "",
        alt_b: parsed.alt_b ?? "",
        alt_c: parsed.alt_c ?? "",
        alt_d: parsed.alt_d ?? "",
        gabarito: letraIdx >= 0 ? letraIdx : 0,
        comentario: parsed.comentario ?? null,
        analise_alternativas: parsed.analise_alternativas ?? null,
        dica_prova: parsed.dica_prova ?? null,
        base_normativa: parsed.base_normativa ?? null,
        arquivo_fonte: escopo.arquivo,
        capitulo: typeof parsed.capitulo === "number" ? parsed.capitulo : (capitulosUsados[0] ?? null),
        artigo: typeof parsed.artigo === "number" ? parsed.artigo : (artigosUsados[0] ?? null),
        dispositivo: parsed.dispositivo ?? null,
        subtopico: parsed.subtopico ?? null,
        evidencias: parsed.evidencias ?? [],
        edital_autorizador: escopo.editalAutorizador,
        data_vigencia: null,
        formato: parsed.formato ?? formato,
        operacao_cognitiva: parsed.operacao_cognitiva ?? null,
        hipotese_concorrente: parsed.hipotese_concorrente ?? null,
        logica_distratores: parsed.logica_distratores ?? {},
        created_by: user.id,
        status: "correcao_necessaria" as string,
      };

      // Verificação determinística imediata (estrutura + escopo)
      const falhas = [
        ...auditarEstrutura(registro as any),
        ...auditarEscopoNormativo(registro as any, [...fontesPorArquivo.keys()]),
      ];
      if (parsed.status === "quarentena" || falhas.some((f) => f.camada === "normativa" && f.severidade === "eliminatoria")) {
        registro.status = "quarentena";
      }

      const { data: inserida, error } = await admin
        .from("cbmto_questoes_editoriais")
        .insert(registro)
        .select("id, disciplina, status, enunciado, gabarito")
        .single();
      if (error) {
        descartadas.push({ disciplina: item.disciplina, motivo: error.message });
        continue;
      }

      await admin.from("cbmto_auditoria_log").insert({
        questao_editorial_id: inserida.id,
        camadas: { geracao: { falhas } },
        falhas,
        status_resultante: registro.status,
        executado_por: user.id,
      });

      assinaturas.unshift(String(registro.enunciado).slice(0, 160));
      geradas.push(inserida);
    }

    return json({
      lote_id: loteId,
      modo,
      geradas: geradas.length,
      descartadas,
      questoes: geradas,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
