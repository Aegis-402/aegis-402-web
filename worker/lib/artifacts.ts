/**
 * Stateless handoff tokens (HMAC-SHA256, base64url).
 *
 * The hub never touches code bytes. It issues two kinds of short-lived tokens:
 *  - upload:   agent → arbiter direct upload (bound to bountyId)
 *  - download: buyer browser → arbiter direct download (bound to bountyId + buyerId)
 * Both are verified by the arbiter with the shared secret (REFEREE_SECRET).
 * Authz happens at issuance time on the hub; expiry bounds the window.
 */

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

/** token = v1.<scope>.<bountyId>.<subject>.<exp>.<sig> */
export async function issueToken(
  secret: string,
  scope: "upload" | "download",
  bountyId: string,
  subject: string,
  ttlSeconds: number,
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = `v1.${scope}.${bountyId}.${subject}.${expiresAt}`;
  const sig = await hmacSign(secret, payload);
  return { token: `${payload}.${sig}`, expiresAt };
}

export interface ParsedToken {
  scope: "upload" | "download";
  bountyId: string;
  subject: string;
  expiresAt: number;
}

/** Verify signature + expiry. Authz (who may hold it) is decided at issuance. */
export async function verifyToken(secret: string, token: string): Promise<ParsedToken | null> {
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "v1") return null;
  const [, scope, bountyId, subject, expStr, sig] = parts;
  if ((scope !== "upload" && scope !== "download") || !bountyId || !subject || !expStr || !sig) return null;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  const expected = await hmacSign(secret, `v1.${scope}.${bountyId}.${subject}.${expiresAt}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  return { scope: scope as "upload" | "download", bountyId, subject, expiresAt };
}
