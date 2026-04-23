import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveTrialWindow, TRIAL_WINDOW_MS } from "./trial-access.ts";

Deno.test("resolveTrialWindow expira conta antiga sem trial_usage", () => {
  const createdAt = "2026-04-11T10:00:00.000Z";
  const nowMs = new Date(createdAt).getTime() + TRIAL_WINDOW_MS + 60_000;

  const result = resolveTrialWindow({ authCreatedAt: createdAt, nowMs });

  assertEquals(result.used, true);
  assertEquals(result.expired, true);
  assertEquals(result.trialEndsAt, new Date(new Date(createdAt).getTime() + TRIAL_WINDOW_MS).toISOString());
});

Deno.test("resolveTrialWindow usa a data mais antiga entre auth, profile e trial", () => {
  const authCreatedAt = "2026-04-20T12:00:00.000Z";
  const profileCreatedAt = "2026-04-11T09:00:00.000Z";
  const trialStartedAt = "2026-04-21T08:00:00.000Z";

  const result = resolveTrialWindow({ authCreatedAt, profileCreatedAt, trialStartedAt, nowMs: new Date(profileCreatedAt).getTime() + 1_000 });

  assertEquals(result.accessStartedAt, profileCreatedAt);
  assertEquals(result.trialEndsAt, new Date(new Date(profileCreatedAt).getTime() + TRIAL_WINDOW_MS).toISOString());
  assertEquals(result.expired, false);
});

Deno.test("resolveTrialWindow limita trial do stripe à janela máxima de 24h da conta", () => {
  const authCreatedAt = "2026-04-11T00:00:00.000Z";
  const trialEndsAt = "2026-04-30T00:00:00.000Z";
  const nowMs = new Date(authCreatedAt).getTime() + TRIAL_WINDOW_MS + 5_000;

  const result = resolveTrialWindow({ authCreatedAt, trialEndsAt, nowMs });

  assertEquals(result.trialEndsAt, new Date(new Date(authCreatedAt).getTime() + TRIAL_WINDOW_MS).toISOString());
  assertEquals(result.expired, true);
});