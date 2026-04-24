const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const FULL_EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export const MP_ACCESS_DAYS = 90;

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
  return Array.from(
    new Set(
      [
        normalizeEmail(payment?.metadata?.email),
        coerceEmailCandidate(payment?.metadata?.email),
        ...extractEmailsFromExternalReference(payment?.external_reference),
        coerceEmailCandidate(payment?.payer?.email),
      ].filter((email): email is string => Boolean(email))
    )
  );
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

    const matches = extractMercadoPagoPaymentEmails(payment).some((email) => normalizedEmails.has(email));
    if (!matches) continue;

    return buildSubscriptionMatch(payment);
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