/**
 * PayPal Payouts API client for the developer payout leg.
 * Runs inside the Cloudflare Worker (Hono). Same OAuth pattern as
 * lib/paypal.ts — raw fetch, zero deps.
 *
 * Money flow: CAPTURE lands full escrow in the business (merchant)
 * account. This module then pushes the developer's net share to their
 * PayPal email. The platform cut stays in business automatically.
 */

import { PAYPAL_CLIENT_ID, type PayPalEnv } from "./paypal.ts";

export type { PayPalEnv };

export const PLATFORM_FEE_BPS = 500; // 5% platform take on capture
export const VOID_FEE_BPS = 100; // 1% cancellation fee when work was attempted

const DEFAULT_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

function apiBase(env: PayPalEnv): string {
  return (env.PAYPAL_API_BASE || DEFAULT_SANDBOX_BASE).replace(/\/$/, "");
}

async function getAccessToken(env: PayPalEnv): Promise<string> {
  const base = apiBase(env);
  const creds = btoa(`${PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
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

/** Split escrow into developer net + platform fee (5%). All values in USD dollars. */
export function splitPayout(escrowAmount: number): { developerAmount: number; platformFee: number } {
  const cents = Math.round(escrowAmount * 100);
  const feeCents = Math.round((cents * PLATFORM_FEE_BPS) / 10_000);
  const devCents = cents - feeCents;
  return { developerAmount: devCents / 100, platformFee: feeCents / 100 };
}

/** 1% void/cancellation fee in dollars (rounded to cents). */
export function voidFeeFor(escrowAmount: number): number {
  return Math.round(((escrowAmount * 100 * VOID_FEE_BPS) / 10_000)) / 100;
}

export interface PayoutResult {
  batchId: string;
  status: string;
}

/**
 * Push developer net share to their PayPal email.
 * sender_batch_id must be unique per payout — callers pass bountyId + capture suffix.
 */
export async function createPayout(
  env: PayPalEnv,
  opts: { toEmail: string; amountUsd: number; batchId: string; note?: string },
): Promise<PayoutResult> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const res = await fetch(`${base}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: opts.batchId.slice(0, 30),
        email_subject: "Aegis-402 bounty payout",
        email_message: opts.note || "Your escrowed bounty work has been approved and paid.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: opts.amountUsd.toFixed(2), currency: "USD" },
          receiver: opts.toEmail,
          note: (opts.note || "Aegis-402 developer payout").slice(0, 255),
          sender_item_id: `bounty-${Date.now().toString(36)}`.slice(0, 30),
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal payout failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { batch_header?: { payout_batch_id?: string; batch_status?: string } };
  const batchId = data.batch_header?.payout_batch_id || opts.batchId;
  return { batchId, status: data.batch_header?.batch_status || "PENDING" };
}

export async function getPayoutStatus(env: PayPalEnv, batchId: string): Promise<{ status: string }> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const res = await fetch(`${base}/v1/payments/payouts/${encodeURIComponent(batchId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal payout lookup failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { batch_header?: { batch_status?: string } };
  return { status: data.batch_header?.batch_status || "UNKNOWN" };
}
