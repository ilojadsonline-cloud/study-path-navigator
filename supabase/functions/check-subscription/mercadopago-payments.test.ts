import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractMercadoPagoPaymentEmails,
  findApprovedMercadoPagoPayment,
  getMercadoPagoSubscriptionsByEmail,
} from "../_shared/mercadopago-payments.ts";

Deno.test("extractMercadoPagoPaymentEmails prioriza metadata, referência externa e payer.email", () => {
  const emails = extractMercadoPagoPaymentEmails({
    metadata: { email: "oliveiraetacio@gmail.com" },
    external_reference: "choa-paid-1776985490605-oliveiraetacio@gmail.com",
    payer: { email: "XXXXXXXXXXX" },
  });

  assertEquals(emails, ["oliveiraetacio@gmail.com"]);
});

Deno.test("findApprovedMercadoPagoPayment encontra pagamento aprovado mesmo com payer.email mascarado", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({
      results: [
        {
          id: 155391542925,
          status: "approved",
          date_created: "2026-04-23T19:05:25.000-04:00",
          date_approved: "2026-04-23T19:07:21.000-04:00",
          payer: { email: "XXXXXXXXXXX" },
          external_reference: "choa-paid-1776985490605-oliveiraetacio@gmail.com",
          metadata: { email: "oliveiraetacio@gmail.com", plan: "trimestral", days: 90 },
        },
      ],
    }), { status: 200 });
  };

  try {
    const result = await findApprovedMercadoPagoPayment("token", ["oliveiraetacio@gmail.com"], new Date("2026-04-24T00:00:00.000Z").getTime());

    assertExists(result);
    assertEquals(result.customer_email, "oliveiraetacio@gmail.com");
    assertEquals(result.payment_id, 155391542925);
    assertEquals(result.provider, "mercadopago");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("getMercadoPagoSubscriptionsByEmail mapeia o pagamento mais recente por email", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({
      results: [
        {
          id: 10,
          status: "approved",
          date_created: "2026-04-23T10:00:00.000-04:00",
          date_approved: "2026-04-23T10:00:10.000-04:00",
          payer: { email: "XXXXXXXXXXX" },
          external_reference: "choa-paid-1-primeiro@gmail.com",
          metadata: { email: "primeiro@gmail.com" },
        },
        {
          id: 11,
          status: "approved",
          date_created: "2026-04-23T11:00:00.000-04:00",
          date_approved: "2026-04-23T11:00:10.000-04:00",
          payer: { email: "mascarado" },
          external_reference: "choa-paid-2-segundo@gmail.com",
          metadata: { email: "segundo@gmail.com" },
        },
      ],
    }), { status: 200 });
  };

  try {
    const result = await getMercadoPagoSubscriptionsByEmail("token", ["primeiro@gmail.com", "segundo@gmail.com"], new Date("2026-04-24T00:00:00.000Z").getTime());

    assertEquals(result.size, 2);
    assertEquals(result.get("primeiro@gmail.com")?.payment_id, 10);
    assertEquals(result.get("segundo@gmail.com")?.payment_id, 11);
  } finally {
    globalThis.fetch = originalFetch;
  }
});