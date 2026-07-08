import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

interface Tentativa {
  id: string;
  simulado_id: string;
  user_id: string;
  started_at: string;
  finished_at: string | null;
  respostas: Record<string, number>;
  acertos: number;
  pontuacao: number;
  status: string;
}

function computeScore(
  respostas: Record<string, number>,
  questoes: { id: string; gabarito: number; anulada?: boolean }[],
  valorQuestao: number,
) {
  let acertos = 0;
  for (const q of questoes) {
    // Questão anulada: todos pontuam nela, independentemente da resposta.
    if (q.anulada) { acertos++; continue; }
    const r = respostas?.[q.id];
    if (typeof r === "number" && r === q.gabarito) acertos++;
  }
  return { acertos, pontuacao: Number((acertos * valorQuestao).toFixed(2)) };
}

function remainingSeconds(t: Tentativa, durMin: number, endsAt: string): number {
  const now = Date.now();
  const started = new Date(t.started_at).getTime();
  const byDuration = durMin * 60 * 1000 - (now - started);
  const byWindow = new Date(endsAt).getTime() - now;
  return Math.floor(Math.min(byDuration, byWindow) / 1000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ── localizar simulado ──
    const loadSimulado = async (simuladoId?: string) => {
      let q = admin.from("simulados_semanais").select("*");
      if (simuladoId) {
        q = q.eq("id", simuladoId);
      } else {
        const nowIso = new Date().toISOString();
        q = q.eq("ativo", true).lte("starts_at", nowIso).gte("ends_at", nowIso).order("starts_at", { ascending: false });
      }
      const { data } = await q.limit(1).maybeSingle();
      return data as any;
    };

    const loadTentativa = async (simuladoId: string): Promise<Tentativa | null> => {
      const { data } = await admin
        .from("simulado_semanal_tentativas")
        .select("*")
        .eq("simulado_id", simuladoId)
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as Tentativa) ?? null;
    };

    const finalizar = async (t: Tentativa, sim: any, respostasOverride?: Record<string, number>) => {
      const { data: qs } = await admin
        .from("simulado_semanal_questoes")
        .select("id, gabarito, anulada")
        .eq("simulado_id", sim.id);
      const respostas = respostasOverride ?? t.respostas ?? {};
      const { acertos, pontuacao } = computeScore(respostas, (qs as any[]) || [], Number(sim.valor_questao));
      const { data: updated } = await admin
        .from("simulado_semanal_tentativas")
        .update({
          status: "finished",
          finished_at: new Date().toISOString(),
          respostas,
          acertos,
          pontuacao,
        })
        .eq("id", t.id)
        .select("*")
        .single();
      return updated as Tentativa;
    };

    // ───────────────── ANNUL / UNANNUL (admin) ─────────────────
    // Marca/desmarca uma questão como anulada e RECALCULA todas as tentativas
    // finalizadas: em questão anulada, todos os alunos pontuam.
    if (action === "annul" || action === "unannul") {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "forbidden" }, 403);

      const questaoId = body.questao_id as string;
      const simuladoId = body.simulado_id as string;
      if (!questaoId || !simuladoId) return json({ error: "Parâmetros inválidos." }, 400);

      const anular = action === "annul";
      const { error: upErr } = await admin
        .from("simulado_semanal_questoes")
        .update({ anulada: anular })
        .eq("id", questaoId)
        .eq("simulado_id", simuladoId);
      if (upErr) return json({ error: upErr.message }, 500);

      const sim = await loadSimulado(simuladoId);
      if (!sim) return json({ error: "Simulado indisponível." }, 404);

      // Recalcula todas as tentativas finalizadas
      const { data: qs } = await admin
        .from("simulado_semanal_questoes")
        .select("id, gabarito, anulada")
        .eq("simulado_id", simuladoId);
      const { data: tentativas } = await admin
        .from("simulado_semanal_tentativas")
        .select("*")
        .eq("simulado_id", simuladoId)
        .eq("status", "finished");

      let recalculadas = 0;
      for (const t of (tentativas as Tentativa[]) || []) {
        const { acertos, pontuacao } = computeScore(t.respostas ?? {}, (qs as any[]) || [], Number(sim.valor_questao));
        await admin
          .from("simulado_semanal_tentativas")
          .update({ acertos, pontuacao })
          .eq("id", t.id);
        recalculadas++;
      }

      return json({ ok: true, anulada: anular, recalculadas });
    }

    // ───────────────── STATUS ─────────────────

    if (action === "status") {
      const sim = await loadSimulado();
      if (!sim) return json({ simulado: null, tentativa: null });
      let tentativa = await loadTentativa(sim.id);
      // auto-finaliza se expirou
      if (tentativa && tentativa.status === "in_progress" && remainingSeconds(tentativa, sim.duracao_minutos, sim.ends_at) <= 0) {
        tentativa = await finalizar(tentativa, sim);
      }
      return json({
        simulado: sim,
        tentativa: tentativa
          ? {
              status: tentativa.status,
              started_at: tentativa.started_at,
              finished_at: tentativa.finished_at,
              acertos: tentativa.acertos,
              pontuacao: tentativa.pontuacao,
              remaining_seconds: tentativa.status === "in_progress" ? remainingSeconds(tentativa, sim.duracao_minutos, sim.ends_at) : 0,
            }
          : null,
      });
    }

    // ───────────────── START / RESUME ─────────────────
    if (action === "start") {
      const sim = await loadSimulado(body.simulado_id);
      if (!sim) return json({ error: "Simulado indisponível." }, 404);
      const nowMs = Date.now();
      if (sim.ativo === false || nowMs < new Date(sim.starts_at).getTime() || nowMs > new Date(sim.ends_at).getTime()) {
        return json({ error: "Este simulado não está aberto no momento." }, 403);
      }

      let tentativa = await loadTentativa(sim.id);

      if (tentativa && tentativa.status === "finished") {
        return json({ error: "already_done", message: "Você já utilizou sua única tentativa." }, 409);
      }

      if (tentativa && tentativa.status === "in_progress" && remainingSeconds(tentativa, sim.duracao_minutos, sim.ends_at) <= 0) {
        await finalizar(tentativa, sim);
        return json({ error: "expired", message: "O tempo da sua tentativa expirou." }, 409);
      }

      if (!tentativa) {
        const { data: created, error } = await admin
          .from("simulado_semanal_tentativas")
          .insert({ simulado_id: sim.id, user_id: user.id, status: "in_progress", started_at: new Date().toISOString() })
          .select("*")
          .single();
        if (error) {
          // corrida: tenta carregar de novo
          tentativa = await loadTentativa(sim.id);
          if (!tentativa) return json({ error: "Não foi possível iniciar o simulado." }, 500);
        } else {
          tentativa = created as Tentativa;
        }
      }

      const { data: qs } = await admin
        .from("simulado_semanal_questoes")
        .select("id, ordem, disciplina, assunto, dificuldade, enunciado, alt_a, alt_b, alt_c, alt_d, alt_e")
        .eq("simulado_id", sim.id)
        .order("ordem", { ascending: true });

      return json({
        simulado: sim,
        tentativa: { id: tentativa.id, started_at: tentativa.started_at, respostas: tentativa.respostas ?? {} },
        questoes: qs ?? [],
        remaining_seconds: remainingSeconds(tentativa, sim.duracao_minutos, sim.ends_at),
      });
    }

    // ───────────────── SAVE (autosave) ─────────────────
    if (action === "save") {
      const sim = await loadSimulado(body.simulado_id);
      if (!sim) return json({ error: "Simulado indisponível." }, 404);
      const tentativa = await loadTentativa(sim.id);
      if (!tentativa || tentativa.status !== "in_progress") return json({ error: "Sem tentativa ativa." }, 409);
      const rem = remainingSeconds(tentativa, sim.duracao_minutos, sim.ends_at);
      if (rem <= 0) {
        const fin = await finalizar(tentativa, sim, body.respostas ?? tentativa.respostas);
        return json({ finished: true, acertos: fin.acertos, pontuacao: fin.pontuacao });
      }
      await admin
        .from("simulado_semanal_tentativas")
        .update({ respostas: body.respostas ?? {} })
        .eq("id", tentativa.id);
      return json({ ok: true, remaining_seconds: rem });
    }

    // ───────────────── SUBMIT ─────────────────
    if (action === "submit") {
      const sim = await loadSimulado(body.simulado_id);
      if (!sim) return json({ error: "Simulado indisponível." }, 404);
      let tentativa = await loadTentativa(sim.id);
      if (!tentativa) return json({ error: "Nenhuma tentativa encontrada." }, 404);
      if (tentativa.status === "finished") {
        return json({ ok: true, acertos: tentativa.acertos, pontuacao: tentativa.pontuacao, already: true });
      }
      tentativa = await finalizar(tentativa, sim, body.respostas ?? tentativa.respostas);
      return json({ ok: true, acertos: tentativa.acertos, pontuacao: tentativa.pontuacao });
    }

    // ───────────────── HISTORY (simulados anteriores liberados p/ revisão) ─────────────────
    if (action === "history") {
      const { data: sims } = await admin
        .from("simulados_semanais")
        .select("id, titulo, descricao, starts_at, ends_at, total_questoes, revisao_liberada")
        .eq("revisao_liberada", true)
        .order("starts_at", { ascending: false });
      const ids = ((sims as any[]) || []).map((s) => s.id);
      if (ids.length === 0) return json({ historico: [] });
      const { data: tents } = await admin
        .from("simulado_semanal_tentativas")
        .select("simulado_id, acertos, pontuacao, finished_at")
        .eq("user_id", user.id)
        .eq("status", "finished")
        .in("simulado_id", ids);
      const tMap = new Map(((tents as any[]) || []).map((t) => [t.simulado_id, t]));
      const historico = ((sims as any[]) || [])
        .filter((s) => tMap.has(s.id))
        .map((s) => ({
          id: s.id,
          titulo: s.titulo,
          descricao: s.descricao,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
          total_questoes: s.total_questoes,
          acertos: tMap.get(s.id).acertos,
          pontuacao: tMap.get(s.id).pontuacao,
          finished_at: tMap.get(s.id).finished_at,
        }));
      return json({ historico });
    }

    // ───────────────── RESULTS (review + ranking) ─────────────────
    if (action === "results") {
      const sim = await loadSimulado(body.simulado_id);
      if (!sim) return json({ error: "Simulado indisponível." }, 404);
      const tentativa = await loadTentativa(sim.id);
      if (!tentativa || tentativa.status !== "finished") {
        return json({ error: "Tentativa não finalizada." }, 403);
      }
      // Simulado encerrado só pode ser revisado se o admin liberou a revisão.
      const janelaAberta = Date.now() <= new Date(sim.ends_at).getTime();
      if (!janelaAberta && !sim.revisao_liberada) {
        return json({ error: "review_locked", message: "A revisão deste simulado ainda não foi liberada." }, 403);
      }
      const { data: qs } = await admin
        .from("simulado_semanal_questoes")
        .select("*")
        .eq("simulado_id", sim.id)
        .order("ordem", { ascending: true });
      const { data: ranking } = await admin.rpc("get_simulado_semanal_ranking", { p_simulado_id: sim.id });
      return json({
        simulado: sim,
        tentativa,
        questoes: qs ?? [],
        ranking: ranking ?? [],
      });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
