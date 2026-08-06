const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const FULL_EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

// Duração padrão do acesso quando o pagamento não traz o plano (mensal = 30 dias).
export const MP_DEFAULT_ACCESS_DAYS = 30;
// Janela de busca de pagamentos no Mercado Pago (precisa cobrir o plano anual).
export const MP_LOOKBACK_DAYS = 400;

// Extrai a duração real do acesso a partir do pagamento (metadata.days ou slug do plano)
export function resolveAccessDays(payment: any): number {
  const metaDays = Number(payment?.metadata?.days);
  if (Number.isFinite(metaDays) && metaDays > 0) return metaDays;

  const slug = String(
    payment?.metadata?.plano_slug ?? payment?.metadata?.plan ?? payment?.external_reference ?? "",
  ).toLowerCase();
  if (slug.includes("anual")) return 365;
  if (slug.includes("trimestral")) return 90;
  if (slug.includes("mensal")) return 30;
  return MP_DEFAULT_ACCESS_DAYS;
}

const SEARCH_LIMIT = 100;
const MAX_SEARCH_PAGES = 10;

// Valor mínimo (BRL) que caracteriza pagamento real do plano trimestral.
// Pagamentos abaixo disso (ex.: autorização de R$ 0 ou R$ 4,99 do Mercado Pago)
// NÃO devem liberar acesso de 90 dias.
const MP_MIN_PAID_AMOUNT = 50;

function getPaymentAmount(payment: any): number {
  const candidates = [
    payment?.transaction_amount,
    payment?.transaction_details?.total_paid_amount,
    payment?.transaction_details?.net_received_amount,
  ];
  for (const value of candidates) {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

function isQualifyingApprovedPayment(payment: any): boolean {
  if (payment?.status !== "approved") return false;
  return getPaymentAmount(payment) >= MP_MIN_PAID_AMOUNT;
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized && normalized.includes("@") ? normalized : null;
}

// Corrige typos comuns em emails (TLDs e provedores populares) para
// aumentar o match entre o email digitado errado no Mercado Pago e o
// email correto usado no cadastro.
const DOMAIN_TYPOS: Array<[RegExp, string]> = [
  [/\.cmom$/, ".com"],
  [/\.ocm$/, ".com"],
  [/\.con$/, ".com"],
  [/\.cm$/, ".com"],
  [/\.comm$/, ".com"],
  [/@gmial\./, "@gmail."],
  [/@gmai\./, "@gmail."],
  [/@gnail\./, "@gmail."],
  [/@hotmial\./, "@hotmail."],
  [/@hotmal\./, "@hotmail."],
  [/@hotnail\./, "@hotmail."],
  [/@yahooo\./, "@yahoo."],
  [/@yaho\./, "@yahoo."],
  [/@outlok\./, "@outlook."],
  [/@outloo\./, "@outlook."],
];

function expandEmailWithTypoFixes(email: string | null): string[] {
  if (!email) return [];
  const set = new Set<string>([email]);
  for (const [pattern, replacement] of DOMAIN_TYPOS) {
    if (pattern.test(email)) {
      const fixed = email.replace(pattern, replacement);
      set.add(fixed);
    }
  }
  return Array.from(set);
}

function coerceEmailCandidate(value?: string | null): string | null {
  const normalized = normalizeEmail(value);
  if (!normalized) return null;
  let embeddedEmail: string | null = null;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char !== "-" && char !== "_" && char !== ":" && char !== "/") continue;

    const suffix = normalized.slice(index + 1);
    if (FULL_EMAIL_REGEX.test(suffix)) embeddedEmail = suffix;
  }

  if (embeddedEmail) return embeddedEmail;
  if (FULL_EMAIL_REGEX.test(normalized)) return normalized;

  return null;
}

function parsePaymentDateMs(payment: any): number | null {
  const value = payment?.date_approved || payment?.date_created;
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function extractEmailsFromExternalReference(value?: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      (value.match(EMAIL_REGEX) || [])
        .map((email) => coerceEmailCandidate(email))
        .filter((email): email is string => Boolean(email))
    )
  );
}

async function fetchRecentMercadoPagoPayments(accessToken: string, nowMs = Date.now()): Promise<any[]> {
  const sinceMs = nowMs - MP_ACCESS_DAYS * 24 * 60 * 60 * 1000;
  const payments: any[] = [];

  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const offset = page * SEARCH_LIMIT;
    const url = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=${SEARCH_LIMIT}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Mercado Pago search failed [${res.status}]: ${errorText}`);
    }

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) break;

    payments.push(...results);

    const oldestPaymentMs = parsePaymentDateMs(results[results.length - 1]);
    if (results.length < SEARCH_LIMIT || (oldestPaymentMs !== null && oldestPaymentMs < sinceMs)) {
      break;
    }
  }

  return payments;
}

export function extractMercadoPagoPaymentEmails(payment: any): string[] {
  const baseEmails = [
    normalizeEmail(payment?.metadata?.email),
    coerceEmailCandidate(payment?.metadata?.email),
    ...extractEmailsFromExternalReference(payment?.external_reference),
    coerceEmailCandidate(payment?.payer?.email),
  ].filter((email): email is string => Boolean(email));

  const expanded = new Set<string>();
  for (const email of baseEmails) {
    for (const variant of expandEmailWithTypoFixes(email)) {
      expanded.add(variant);
    }
  }
  return Array.from(expanded);
}

export function extractPrimaryMercadoPagoPaymentEmail(payment: any): string | null {
  return extractMercadoPagoPaymentEmails(payment)[0] ?? null;
}

export interface MercadoPagoSubscriptionMatch {
  provider: "mercadopago";
  payment_id: string | number | null;
  customer_email: string | null;
  paid_at: string | null;
  subscription_end: string;
}

function buildSubscriptionMatch(payment: any): MercadoPagoSubscriptionMatch | null {
  const paidAtMs = parsePaymentDateMs(payment);
  if (!paidAtMs) return null;

  const endDate = new Date(paidAtMs);
  endDate.setDate(endDate.getDate() + MP_ACCESS_DAYS);

  return {
    provider: "mercadopago",
    payment_id: payment?.id ?? null,
    customer_email: extractPrimaryMercadoPagoPaymentEmail(payment),
    paid_at: new Date(paidAtMs).toISOString(),
    subscription_end: endDate.toISOString(),
  };
}

export async function findApprovedMercadoPagoPayment(
  accessToken: string,
  emails: string[],
  nowMs = Date.now()
): Promise<MercadoPagoSubscriptionMatch | null> {
  const normalizedEmails = new Set(
    emails.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email))
  );
  if (normalizedEmails.size === 0) return null;

  const sinceMs = nowMs - MP_ACCESS_DAYS * 24 * 60 * 60 * 1000;
  const payments = await fetchRecentMercadoPagoPayments(accessToken, nowMs);

  for (const payment of payments) {
    if (!isQualifyingApprovedPayment(payment)) continue;

    const paidAtMs = parsePaymentDateMs(payment);
    if (!paidAtMs || paidAtMs < sinceMs) continue;

    const paymentEmails = extractMercadoPagoPaymentEmails(payment);
    const matchedEmail = paymentEmails.find((email) => normalizedEmails.has(email));
    if (!matchedEmail) continue;

    const match = buildSubscriptionMatch(payment);
    if (match) match.customer_email = matchedEmail;
    return match;
  }

  return null;
}

export async function getMercadoPagoSubscriptionsByEmail(
  accessToken: string,
  emails: string[],
  nowMs = Date.now()
): Promise<Map<string, MercadoPagoSubscriptionMatch>> {
  const normalizedEmails = Array.from(
    new Set(emails.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email)))
  );
  const emailSet = new Set(normalizedEmails);
  const matches = new Map<string, MercadoPagoSubscriptionMatch>();

  if (emailSet.size === 0) return matches;

  const sinceMs = nowMs - MP_ACCESS_DAYS * 24 * 60 * 60 * 1000;
  const payments = await fetchRecentMercadoPagoPayments(accessToken, nowMs);

  for (const payment of payments) {
    if (!isQualifyingApprovedPayment(payment)) continue;

    const paidAtMs = parsePaymentDateMs(payment);
    if (!paidAtMs || paidAtMs < sinceMs) continue;

    const record = buildSubscriptionMatch(payment);
    if (!record) continue;

    for (const email of extractMercadoPagoPaymentEmails(payment)) {
      if (!emailSet.has(email)) continue;

      const current = matches.get(email);
      if (!current || new Date(record.paid_at ?? 0).getTime() > new Date(current.paid_at ?? 0).getTime()) {
        matches.set(email, record);
      }
    }
  }

  return matches;
}
// =============================================================================
// MercadoPago Preapproval (assinatura recorrente) lookup
// =============================================================================

export interface MercadoPagoPreapprovalMatch {
  provider: "mercadopago";
  preapproval_id: string | null;
  status: string;
  is_trial: boolean;
  next_payment_date: string | null;
  trial_ends_at: string | null;
}

export async function findActiveMercadoPagoPreapproval(
  accessToken: string,
  emails: string[],
): Promise<MercadoPagoPreapprovalMatch | null> {
  const normalizedEmails = Array.from(
    new Set(emails.map((e) => normalizeEmail(e)).filter((e): e is string => Boolean(e))),
  );
  if (normalizedEmails.length === 0) return null;

  for (const email of normalizedEmails) {
    try {
      const url = `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(email)}&sort=date_created:desc&limit=20`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) continue;
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];

      for (const pre of results) {
        if (pre?.status !== "authorized") continue;

        const ar = pre?.auto_recurring ?? {};
        const summarized = pre?.summarized ?? {};
        const chargedQty = Number(summarized?.charged_quantity ?? 0);
        const freeTrial = ar?.free_trial;

        // Detecta trial vigente: existe free_trial configurado e ainda não houve cobrança
        let isTrial = false;
        let trialEndsAt: string | null = null;
        if (freeTrial && chargedQty === 0) {
          const startMs = new Date(pre?.date_created ?? Date.now()).getTime();
          const freq = Number(freeTrial?.frequency ?? 0);
          const ftype = String(freeTrial?.frequency_type ?? "days");
          const multiplier = ftype === "months" ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
          const endMs = startMs + freq * multiplier;
          if (Date.now() < endMs) {
            isTrial = true;
            trialEndsAt = new Date(endMs).toISOString();
          }
        }

        return {
          provider: "mercadopago",
          preapproval_id: pre?.id ?? null,
          status: pre.status,
          is_trial: isTrial,
          next_payment_date: pre?.next_payment_date ?? null,
          trial_ends_at: trialEndsAt,
        };
      }
    } catch (err) {
      console.error("[MP-PREAPPROVAL] lookup error", { email, err: String(err) });
    }
  }

  return null;
}
