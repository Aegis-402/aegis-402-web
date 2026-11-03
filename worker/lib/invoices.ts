/**
 * PayPal Invoices API client — settlement receipts.
 * Raw fetch (Workers-safe, zero deps), same endpoints/payload shapes as
 * @paypal/agent-toolkit's create_invoice / send_invoice / record_payment
 * tools. The toolkit itself is Node-oriented (axios/os/Buffer, ~100 deps)
 * and has no direct-call export, so the edge worker talks to the Invoices
 * API directly instead of importing it.
 *
 * Flow per SETTLED bounty: create (DRAFT) → send (SENT to buyer + dev) →
 * record the capture as payment (PAID). All best-effort: receipt failures
 * must never fail a settlement.
 */

import type { PayPalEnv } from "./paypal.ts";

const DEFAULT_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

function apiBase(env: PayPalEnv): string {
  return (env.PAYPAL_API_BASE || DEFAULT_SANDBOX_BASE).replace(/\/$/, "");
}

async function getAccessToken(env: PayPalEnv): Promise<string> {
  const base = apiBase(env);
  const creds = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal OAuth failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal OAuth returned no access_token");
  return data.access_token;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface SettlementInvoiceInput {
  bountyId: string;
  bountyTitle: string;
  escrowAmount: number;
  platformFee: number;
  developerAmount: number;
  captureId: string;
  buyerEmail: string;
  developerEmail?: string | null;
  attestationPrefix?: string;
}

export interface InvoiceResult {
  invoiceId: string;
  status: string;
}

/** Create a DRAFT receipt invoice for a settled bounty. */
export async function createSettlementInvoice(
  env: PayPalEnv,
  input: SettlementInvoiceInput,
): Promise<InvoiceResult> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`${base}/v2/invoicing/invoices`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      detail: {
        currency_code: "USD",
        invoice_date: today,
        note: `Aegis-402 escrow settlement for ${input.bountyId}. Attestation: ${input.attestationPrefix || "n/a"}. Capture: ${input.captureId}.`,
      },
      primary_recipients: [
        { billing_info: [{ email_address: input.buyerEmail }] },
      ],
      items: [
        {
          name: `Bounty delivery — ${input.bountyTitle.slice(0, 80)}`,
          quantity: "1",
          unit_amount: { currency_code: "USD", value: input.developerAmount.toFixed(2) },
        },
        {
          name: "Aegis-402 platform fee (5%)",
          quantity: "1",
          unit_amount: { currency_code: "USD", value: input.platformFee.toFixed(2) },
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal invoice create failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string; status?: string };
  if (!data.id) throw new Error("PayPal invoice create returned no id");
  return { invoiceId: data.id, status: data.status || "DRAFT" };
}

/** Send the invoice to the buyer (developer as additional recipient when known). */
export async function sendSettlementInvoice(
  env: PayPalEnv,
  invoiceId: string,
  developerEmail?: string | null,
): Promise<void> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const body: Record<string, unknown> = { send_to_recipient: true };
  if (developerEmail) {
    body.additional_recipients = [developerEmail];
  }
  const res = await fetch(`${base}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal invoice send failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

/** Record the escrow capture as payment so the receipt reads PAID. */
export async function recordInvoicePayment(
  env: PayPalEnv,
  invoiceId: string,
  amountUsd: number,
  captureId: string,
): Promise<void> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`${base}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      payment_id: captureId.slice(0, 127),
      payment_date: today,
      method: "PAYPAL",
      note: "Aegis-402 escrow capture",
      amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
    }),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal invoice record-payment failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}
