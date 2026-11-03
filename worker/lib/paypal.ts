/**
 * PayPal Orders v2 minimal client for Aegis-402 escrow.
 * Runs inside the Cloudflare Worker (Hono). Uses sandbox credentials
 * from worker env (.dev.vars locally, wrangler secrets in production).
 *
 * Flow:
 *  1. getAccessToken() — OAuth2 client_credentials
 *  2. createAuthorizeOrder() — POST /v2/checkout/orders intent:AUTHORIZE
 *  3. authorizeOrder() — POST /v2/checkout/orders/{id}/authorize (after buyer approves)
 *  4. captureAuthorization() — POST /v2/payments/authorizations/{id}/capture
 *  5. voidAuthorization() — POST /v2/payments/authorizations/{id}/void
 */

export interface PayPalEnv {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_API_BASE?: string;
}

const DEFAULT_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

export function paypalConfigured(env: PayPalEnv): boolean {
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

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

/** Retry transient failures (DNS blips, 429, 5xx) with exponential backoff.
 *  Reads only — never use on money-moving writes (capture/void/authorize). */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastErr: unknown = new Error("fetch failed with no response");
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status === 404 || (res.status < 500 && res.status !== 429)) {
        return res;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface CreatedOrder {
  orderId: string;
  approveLink: string;
  status: string;
}

/** Step 1: create an AUTHORIZE order. Buyer must approve via approveLink. */
export async function createAuthorizeOrder(
  env: PayPalEnv,
  amountUsd: number,
  description: string,
): Promise<CreatedOrder> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      intent: "AUTHORIZE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
          description: description.slice(0, 120),
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal create order failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    id?: string;
    status?: string;
    links?: Array<{ rel?: string; href?: string }>;
  };
  if (!data.id) throw new Error("PayPal create order returned no id");
  const approveLink = data.links?.find((l) => l.rel === "approve")?.href || "";
  return { orderId: data.id, approveLink, status: data.status || "CREATED" };
}

/** Step 2: after buyer approves, authorize the order → returns authorization_id (the lock). */
export async function authorizeOrder(
  env: PayPalEnv,
  orderId: string,
): Promise<{ authorizationId: string; status: string }> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const res = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal authorize failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    purchase_units?: Array<{
      payments?: { authorizations?: Array<{ id?: string; status?: string }> };
    }>;
  };
  const auth = data.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error("PayPal authorize returned no authorization id");
  return { authorizationId: auth.id, status: auth.status || "CREATED" };
}

/** Step 3a: capture a locked authorization. Attestation hash goes in custom_id.
 *  Optional amountUsd performs a partial capture (used for the 1% void fee leg). */
export async function captureAuthorization(
  env: PayPalEnv,
  authorizationId: string,
  attestationHash?: string,
  amountUsd?: number,
): Promise<{ captureId: string; status: string }> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const body: Record<string, unknown> = {};
  if (attestationHash) body.custom_id = `AEGIS-${attestationHash.slice(0, 16).toUpperCase()}`;
  if (typeof amountUsd === "number" && amountUsd > 0) {
    body.amount = { currency_code: "USD", value: amountUsd.toFixed(2) };
  }
  const res = await fetch(
    `${base}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal capture failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string; status?: string };
  if (!data.id) throw new Error("PayPal capture returned no id");
  return { captureId: data.id, status: data.status || "COMPLETED" };
}

/** Escrow verification: is the PayPal authorization actually live? */
export interface AuthorizationStatus {
  id: string;
  status: string; // CREATED = locked, CAPTURED, VOIDED, EXPIRED, DENIED, NOT_FOUND
  amount: string;
  currency: string;
  expirationTime?: string;
}

export async function getAuthorizationStatus(
  env: PayPalEnv,
  authorizationId: string,
): Promise<AuthorizationStatus> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const res = await fetchWithRetry(
    `${base}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) {
    return { id: authorizationId, status: "NOT_FOUND", amount: "0.00", currency: "USD" };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal auth lookup failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    id?: string;
    status?: string;
    amount?: { value?: string; currency_code?: string };
    expiration_time?: string;
  };
  return {
    id: data.id || authorizationId,
    status: data.status || "UNKNOWN",
    amount: data.amount?.value || "0.00",
    currency: data.amount?.currency_code || "USD",
    expirationTime: data.expiration_time,
  };
}

/** Step 3b: void a locked authorization (instant refund). */
export async function voidAuthorization(
  env: PayPalEnv,
  authorizationId: string,
): Promise<{ status: string }> {
  const token = await getAccessToken(env);
  const base = apiBase(env);
  const res = await fetch(
    `${base}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );
  // PayPal void returns 204 No Content on success
  if (res.status === 204 || res.ok) return { status: "VOIDED" };
  const text = await res.text().catch(() => "");
  throw new Error(`PayPal void failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
}
