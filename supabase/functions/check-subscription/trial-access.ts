export const TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000;

function parseDateMs(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function minTimestamp(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

export interface TrialWindowInput {
  authCreatedAt?: string | null;
  profileCreatedAt?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  convertedToPaid?: boolean;
  nowMs?: number;
}

export interface TrialWindowStatus {
  accessStartedAt: string | null;
  trialEndsAt: string | null;
  used: boolean;
  expired: boolean;
}

export function resolveTrialWindow(input: TrialWindowInput): TrialWindowStatus {
  const nowMs = input.nowMs ?? Date.now();
  const accessStartMs = minTimestamp([
    parseDateMs(input.authCreatedAt),
    parseDateMs(input.profileCreatedAt),
    parseDateMs(input.trialStartedAt),
  ]);

  if (!accessStartMs) {
    return {
      accessStartedAt: null,
      trialEndsAt: null,
      used: false,
      expired: false,
    };
  }

  const accountWindowEndMs = accessStartMs + TRIAL_WINDOW_MS;
  const storedTrialEndMs = parseDateMs(input.trialEndsAt);
  const effectiveTrialEndMs = storedTrialEndMs
    ? Math.min(storedTrialEndMs, accountWindowEndMs)
    : accountWindowEndMs;

  return {
    accessStartedAt: new Date(accessStartMs).toISOString(),
    trialEndsAt: new Date(effectiveTrialEndMs).toISOString(),
    used: true,
    expired: input.convertedToPaid === true ? false : effectiveTrialEndMs <= nowMs,
  };
}