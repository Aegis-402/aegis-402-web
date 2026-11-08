import { Hono } from "hono";
import { z } from "zod";
import { createAuth } from "./lib/auth.ts";
import { requireAuth, requireRole, type AppEnv } from "./lib/middleware.ts";
import { requireDeveloperOrAgent } from "./lib/agent-auth.ts";
import {
  mintAgentKey,
  listAgents,
  revokeAgent,
  ownsAgent,
} from "./lib/agent-keys.ts";
import { eq, inArray } from "drizzle-orm";
import * as schema from "./db/schema.ts";
import {
  hubDb,
  getAllBountyRecords,
  getBountyRecord,
  putBountyRecord,
  type BountyRecord,
} from "./lib/store.ts";
import { issueToken } from "./lib/artifacts.ts";
import {
  createPayout,
  splitPayout,
  voidFeeFor,
  type PayPalEnv,
} from "./lib/payouts.ts";
import {
  createSettlementInvoice,
  sendSettlementInvoice,
  recordInvoicePayment,
} from "./lib/invoices.ts";
import {
  PAYPAL_CLIENT_ID,
  createAuthorizeOrder,
  authorizeOrder,
  getAuthorizationStatus,
  captureAuthorization,
  voidAuthorization,
} from "./lib/paypal.ts";
import { validateAndNormalizeOpenApi } from "./lib/openapi.ts";

const app = new Hono<AppEnv>();

const createBountySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  escrowAmount: z.coerce.number().positive().max(100000),
  category: z.enum(["Web App", "API / Backend", "AI Agent Tool"]).default("Web App"),
  // Real PayPal lock only — demo AUTH-xxx ids are rejected at settlement.
  payPalAuthorizationId: z.string().trim().min(1).max(64),
  problemStatement: z.string().trim().min(20).max(2000).optional(),
  requirements: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  techConstraints: z.string().trim().max(500).optional(),
  timeline: z.string().trim().max(120).optional(),
  referenceLinks: z.array(z.string().trim().url().max(500)).max(10).optional(),
  // Buyer-attached OpenAPI contract (JSON string or object, ≤100KB).
  // Required for "API / Backend"; normalized + stored by the handler.
  openApiSpec: z.unknown().optional(),
});
const claimSchema = z.object({ agentId: z.string().trim().min(1).max(64).optional() });
const checkpointSchema = z.object({
  stage: z.enum(["SCAFFOLDING", "CORE_LOGIC", "TESTING", "FINAL_POLISH"]),
  summary: z.string().trim().max(500).optional(),
  testsPassed: z.number().int().min(0).optional(),
  testsTotal: z.number().int().min(0).optional(),
});
const deliverSchema = z.object({ deliverableUrl: z.url().max(2048).optional() });
const artifactSchema = z.object({
  sha256: z.string().trim().regex(/^[0-9a-fA-F]{64}$/, "sha256 must be 64 hex chars"),
  byteSize: z.number().int().min(1).max(100_000_000),
});

// Better Auth endpoint handler
// Roles are chosen at sign-up only: block any attempt to change role/paypal later via update-user.
app.post("/api/auth/update-user", async (c, next) => {
  const body = (await c.req.raw.clone().json().catch(() => ({}))) as Record<string, unknown>;
  if ("role" in body) return c.json({ error: "Role cannot be changed" }, 403);
  await next();
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env, c.req.url);
  return auth.handler(c.req.raw);
});

// API Healthcheck
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    name: "Aegis-402 Settlement API",
    engine: "Cloudflare Workers + Hono",
    timestamp: new Date().toISOString(),
  });
});

// Public runtime config (no auth — landing needs the PayPal client id
// pre-login). Single supply path: values come from worker env, which is
// `.dev.vars` locally and dashboard Variables in prod. Never put secrets
// here — everything returned is shipped to the browser by design.
app.get("/api/public-config", async (c) => {
  const envMap = c.env as unknown as Record<string, string | undefined>;
  return c.json({
    paypalClientId: PAYPAL_CLIENT_ID,
    arbiterWsUrl: envMap.ARBITER_WS_URL || "wss://aegis-arbiter.ayiba.dev/screencast",
    agStudioLicenseKey: envMap.AG_STUDIO_LICENSE_KEY || "",
  });
});

// Public view: never expose the deliverable URL, lease token, or the full
// OpenAPI blob (zero-leak invariant + payload size). Spec metadata
// (hash/count) stays so lists can badge "contract attached"; the blob is
// served by GET /api/bounties/:id/openapi.
const publicView = (b: BountyRecord) => {
  const { deliverableUrl: _u, leaseToken: _l, openApiSpec: _s, ...rest } = b;
  return rest;
};

// List Bounties (D1-backed — survives worker restarts)
app.get("/api/bounties", async (c) => {
  const all = await getAllBountyRecords(hubDb(c.env));
  return c.json(all.map(publicView));
});

// Get Single Bounty
app.get("/api/bounties/:id", async (c) => {
  const id = c.req.param("id");
  const bounty = await getBountyRecord(hubDb(c.env), id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  return c.json(publicView(bounty));
});

// Fetch the buyer-attached OpenAPI contract for a bounty.
// Dual auth: agent keys (x-agent-key, workers pre-flighting validate) and
// human sessions of any role (buyer reviewing their own contract, developer
// implementing it). 404 when the bounty carries no spec.
app.get("/api/bounties/:id/openapi", async (c) => {
  const id = c.req.param("id");
  const bounty = await getBountyRecord(hubDb(c.env), id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (!bounty.openApiSpec) return c.json({ error: "No OpenAPI spec attached to this bounty" }, 404);

  // 1. Agent key path (MCP/CLI workers, no session cookie).
  const provided = c.req.header("x-agent-key");
  if (provided) {
    const { validateAgentKey } = await import("./lib/agent-keys.ts");
    let ok = false;
    try {
      ok = (await validateAgentKey(hubDb(c.env), provided)) !== null;
    } catch {
      ok = (await validateAgentKey(null, provided)) !== null;
    }
    if (!ok) {
      return c.json({ error: "Invalid or revoked agent key" }, 401);
    }
  } else {
    // 2. Human session path (any role).
    const { createAuth } = await import("./lib/auth.ts");
    const auth = createAuth(c.env, c.req.url);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ error: "Authentication required" }, 401);
  }

  let spec: unknown;
  try {
    spec = JSON.parse(bounty.openApiSpec);
  } catch {
    return c.json({ error: "Stored spec is corrupt" }, 500);
  }
  return c.json({
    bountyId: bounty.id,
    hash: bounty.openApiSpecHash,
    endpointCount: bounty.openApiEndpointCount,
    spec,
  });
});

// Post a new bounty with pre-authorized PayPal Escrow (buyers only)
app.post("/api/bounties", requireAuth, requireRole("BUYER"), async (c) => {
  const parsed = createBountySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid bounty", issues: parsed.error.issues }, 400);
  const body = parsed.data;
  const id = `bounty-${Math.random().toString(36).substring(2, 9)}`;
  const clean = (arr?: string[]) => (arr || []).map((s) => s.trim()).filter(Boolean);
  const requirements = clean(body.requirements);
  const acceptanceCriteria = clean(body.acceptanceCriteria);
  const referenceLinks = clean(body.referenceLinks);

  // Buyer-attached OpenAPI contract: required for API/Backend, optional
  // otherwise. Normalized to canonical JSON here; stored immutably — no
  // update route mutates it, so claim-time contract == grading-time contract.
  let openApiSpec: string | undefined;
  let openApiSpecHash: string | undefined;
  let openApiEndpointCount: number | undefined;
  if (body.openApiSpec !== undefined) {
    try {
      const normalized = await validateAndNormalizeOpenApi(body.openApiSpec);
      openApiSpec = normalized.specJson;
      openApiSpecHash = normalized.hash;
      openApiEndpointCount = normalized.endpointCount;
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  } else if (body.category === "API / Backend") {
    return c.json({ error: "API / Backend bounties require an OpenAPI 3.x spec (JSON)." }, 400);
  }
  const problemStatement = body.problemStatement?.trim() || body.description?.trim() || "";
  const composed = [
    problemStatement,
    requirements.length ? `Requirements:\n${requirements.map((r) => `- ${r}`).join("\n")}` : "",
    acceptanceCriteria.length ? `Acceptance criteria:\n${acceptanceCriteria.map((a) => `- [ ] ${a}`).join("\n")}` : "",
    body.techConstraints?.trim() ? `Tech constraints: ${body.techConstraints.trim()}` : "",
    body.timeline?.trim() ? `Timeline: ${body.timeline.trim()}` : "",
    referenceLinks.length ? `References:\n${referenceLinks.join("\n")}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 2000);
  const newBounty: BountyRecord = {
    id,
    title: body.title,
    description: composed || "Deliverable specification secured by Aegis-402 PayPal Escrow.",
    problemStatement: problemStatement.slice(0, 2000) || undefined,
    requirements: requirements.length ? requirements : undefined,
    acceptanceCriteria: acceptanceCriteria.length ? acceptanceCriteria : undefined,
    techConstraints: body.techConstraints?.trim() || undefined,
    timeline: body.timeline?.trim() || undefined,
    referenceLinks: referenceLinks.length ? referenceLinks : undefined,
    openApiSpec,
    openApiSpecHash,
    openApiEndpointCount,
    escrowAmount: body.escrowAmount,
    currency: "USD",
    status: "OPEN_FOR_CLAIM",
    category: body.category,
    // Guaranteed present by createBountySchema (real AUTHORIZE id from PostBountyModal).
    payPalAuthorizationId: body.payPalAuthorizationId,
    testsPassed: 0,
    testsTotal: 10,
    currentStage: "SCAFFOLDING",
    checkpoints: [],
    createdAt: Date.now(),
    creatorId: c.get("user").id,
  };

  const db = hubDb(c.env);
  await putBountyRecord(db, newBounty);
  return c.json(publicView(newBounty), 201);
});

// Agent key management (human developers only — agents cannot mint keys)
const agentNameSchema = z.object({
  name: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_\-.]+$/),
  framework: z.enum(["Claude Code", "Cursor", "Windsurf", "OpenCode", "Custom stdio"]).default("Claude Code"),
});

// Mint a per-agent API key (plaintext returned ONCE — dashboard must show it immediately)
app.post("/api/agents", requireAuth, requireRole("DEVELOPER"), async (c) => {
  const parsed = agentNameSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid agent name", issues: parsed.error.issues }, 400);
  const minted = await mintAgentKey(hubDb(c.env), c.get("user").id, parsed.data.name, parsed.data.framework);
  return c.json(minted, 201);
});

// List my agents (metadata only — never plaintext keys)
app.get("/api/agents", requireAuth, requireRole("DEVELOPER"), async (c) => {
  return c.json(await listAgents(hubDb(c.env), c.get("user").id));
});

// Revoke an agent key
app.post("/api/agents/:id/revoke", requireAuth, requireRole("DEVELOPER"), async (c) => {
  const ok = await revokeAgent(hubDb(c.env), c.get("user").id, c.req.param("id"));
  if (!ok) return c.json({ error: "Agent not found" }, 404);
  return c.json({ status: "REVOKED" });
});

// Claim lease (developers only; MCP agents via x-agent-key)
app.post("/api/bounties/:id/claim", requireDeveloperOrAgent, async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "OPEN_FOR_CLAIM") return c.json({ error: "Bounty is not open for claim" }, 409);

  const body = claimSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid request" }, 400);
  // 30-minute leases (generous for autonomous workers on free-tier infra).
  const leaseToken = `lease-${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = Date.now() + 30 * 60 * 1000;

  // Agent-only claiming: bare human accounts cannot hold leases.
  // x-agent-key callers claim as themselves; human sessions must name one
  // of their registered agents (ownsAgent = exists, unrevoked, owned).
  const callerAgentId = c.get("agentId");
  let leaseAgentId: string;
  if (callerAgentId) {
    leaseAgentId = callerAgentId;
  } else {
    const requested = body.data.agentId?.trim();
    if (!requested) {
      return c.json({ error: "Claiming requires a registered agent — pass agentId of one of your agents" }, 400);
    }
    if (!(await ownsAgent(db, c.get("user").id, requested))) {
      return c.json({ error: "Unknown agent, revoked key, or agent not owned by you" }, 403);
    }
    leaseAgentId = requested;
  }

  bounty.status = "IN_PROGRESS";
  bounty.workerAgentId = leaseAgentId;
  bounty.workerUserId = leaseAgentId;
  bounty.claimCount = (bounty.claimCount || 0) + 1;
  const seen = new Set(bounty.workerHistory || []);
  seen.add(leaseAgentId);
  bounty.workerHistory = Array.from(seen);
  bounty.rejectionReason = undefined;
  bounty.leaseToken = leaseToken;
  bounty.leaseExpiresAt = expiresAt;
  await putBountyRecord(db, bounty);

  return c.json({
    bountyId: bounty.id,
    agentId: leaseAgentId,
    leaseToken,
    expiresAt,
    status: "ACTIVE",
  });
});

// Push checkpoint (the developer holding the lease; MCP agents via x-agent-key)
app.post("/api/bounties/:id/checkpoints", requireDeveloperOrAgent, async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "IN_PROGRESS") return c.json({ error: "Bounty has no active lease" }, 409);
  const leaseHolder = c.get("user").id;
  if (
    bounty.workerUserId &&
    bounty.workerUserId !== leaseHolder &&
    !(await ownsAgent(db, leaseHolder, bounty.workerUserId))
  ) {
    return c.json({ error: "You do not hold the lease on this bounty" }, 403);
  }

  const parsed = checkpointSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid checkpoint", issues: parsed.error.issues }, 400);
  const body = parsed.data;
  const chk = {
    stage: body.stage,
    summary: body.summary || "Progress checkpoint",
    testsPassed: body.testsPassed ?? bounty.testsPassed,
    testsTotal: body.testsTotal ?? bounty.testsTotal,
    timestamp: Date.now(),
  };

  bounty.checkpoints.push(chk);
  bounty.testsPassed = chk.testsPassed;
  bounty.testsTotal = chk.testsTotal;
  bounty.currentStage = chk.stage;
  bounty.leaseExpiresAt = Date.now() + 30 * 60 * 1000; // renew lease
  await putBountyRecord(db, bounty);

  return c.json({ status: "RECORDED", checkpoint: chk, leaseExpiresAt: bounty.leaseExpiresAt });
});

// Submit deliverable URL (the developer holding the lease; MCP agents via x-agent-key)
app.post("/api/bounties/:id/deliver", requireDeveloperOrAgent, async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "IN_PROGRESS") return c.json({ error: "Bounty has no active lease" }, 409);
  const leaseHolder = c.get("user").id;
  if (
    bounty.workerUserId &&
    bounty.workerUserId !== leaseHolder &&
    !(await ownsAgent(db, leaseHolder, bounty.workerUserId))
  ) {
    return c.json({ error: "You do not hold the lease on this bounty" }, 403);
  }

  const parsed = deliverSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid deliver payload" }, 400);
  if (!bounty.artifactSha256) {
    return c.json({ error: "Seal the code vault first (POST /api/bounties/:id/artifact) — the arbiter provisions from sealed code only" }, 409);
  }
  // Hand off to the arbiter: it provisions the sandbox, then marks READY_FOR_REVIEW.
  bounty.status = "PROVISIONING";
  if (parsed.data.deliverableUrl) bounty.deliverableUrl = parsed.data.deliverableUrl;
  bounty.provisionStartedAt = Date.now();
  bounty.provisionError = undefined;
  bounty.latestProgress = "Queued for sandbox provisioning";
  bounty.verificationSummary = undefined;
  await putBountyRecord(db, bounty);

  return c.json({
    status: "PROVISIONING",
    bountyId: bounty.id,
  });
});

// Code handoff registration: agent commits the tarball hash; bytes go
// DIRECTLY to the arbiter (never through the hub — free-tier friendly).
// Returns a one-time upload token + the arbiter upload URL.
app.post("/api/bounties/:id/artifact", requireDeveloperOrAgent, async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "IN_PROGRESS") return c.json({ error: "Bounty has no active lease" }, 409);
  const leaseHolder = c.get("user").id;
  if (
    bounty.workerUserId &&
    bounty.workerUserId !== leaseHolder &&
    !(await ownsAgent(db, leaseHolder, bounty.workerUserId))
  ) {
    return c.json({ error: "You do not hold the lease on this bounty" }, 403);
  }

  const parsed = artifactSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid artifact", issues: parsed.error.issues }, 400);
  const envMap = c.env as unknown as Record<string, string | undefined>;
  if (!envMap.REFEREE_SECRET) {
    return c.json({ error: "Arbiter handoff not configured (REFEREE_SECRET)" }, 503);
  }
  bounty.artifactSha256 = parsed.data.sha256.toLowerCase();
  bounty.artifactByteSize = parsed.data.byteSize;
  bounty.leaseExpiresAt = Date.now() + 30 * 60 * 1000; // registering is progress
  await putBountyRecord(db, bounty);

  const arbiterUrl = (envMap.ARBITER_PUBLIC_URL || "https://aegis-arbiter.ayiba.dev").replace(/\/$/, "");
  const { token, expiresAt } = await issueToken(envMap.REFEREE_SECRET, "upload", id, bounty.workerUserId || "agent", 1800);
  return c.json({
    status: "REGISTERED",
    bountyId: id,
    sha256: bounty.artifactSha256,
    byteSize: bounty.artifactByteSize,
    uploadUrl: `${arbiterUrl}/api/artifacts/${encodeURIComponent(id)}/upload`,
    uploadToken: token,
    uploadExpiresAt: expiresAt,
  });
});

// Vault metadata (hash + size only — no secrets). Any signed-in user.
app.get("/api/bounties/:id/artifact", requireAuth, async (c) => {
  const id = c.req.param("id");
  const bounty = await getBountyRecord(hubDb(c.env), id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (!bounty.artifactSha256) return c.json({ hasArtifact: false }, 404);
  return c.json({ hasArtifact: true, bountyId: id, sha256: bounty.artifactSha256, byteSize: bounty.artifactByteSize });
});

// Buyer download: funding buyer only, ONLY after PayPal CAPTURE.
// Returns an expiring signed URL — the BROWSER pulls bytes straight from the
// arbiter. Hub checks authz, arbiter checks the signature. Nothing via D1.
app.get("/api/bounties/:id/artifact/download", requireAuth, requireRole("BUYER"), async (c) => {
  const id = c.req.param("id");
  const bounty = await getBountyRecord(hubDb(c.env), id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.creatorId && bounty.creatorId !== c.get("user").id) {
    return c.json({ error: "Only the buyer who funded this bounty can download its code" }, 403);
  }
  if (bounty.status !== "SETTLED") {
    return c.json({ error: "Code releases only after PayPal capture — source stays sealed until you pay" }, 402);
  }
  if (!bounty.artifactSha256) return c.json({ error: "No code artifact for this bounty" }, 404);
  const envMap = c.env as unknown as Record<string, string | undefined>;
  if (!envMap.REFEREE_SECRET) {
    return c.json({ error: "Arbiter handoff not configured (REFEREE_SECRET)" }, 503);
  }
  const arbiterUrl = (envMap.ARBITER_PUBLIC_URL || "https://aegis-arbiter.ayiba.dev").replace(/\/$/, "");
  const { token, expiresAt } = await issueToken(envMap.REFEREE_SECRET, "download", id, c.get("user").id, 900);
  return c.json({
    bountyId: id,
    sha256: bounty.artifactSha256,
    url: `${arbiterUrl}/api/artifacts/${encodeURIComponent(id)}/download?token=${encodeURIComponent(token)}`,
    expiresAt,
  });
});

// PayPal Orders v2: create AUTHORIZE order (buyers only)
// Returns orderId + approveLink. Buyer approves in PayPal UI, then calls /authorize-order.
app.post("/api/paypal/create-order", requireAuth, requireRole("BUYER"), async (c) => {
  const envMap = c.env as unknown as Record<string, string | undefined>;
  const body = (await c.req.json().catch(() => ({}))) as {
    amountUsd?: number;
    description?: string;
  };
  const amount = Number(body.amountUsd);
  if (!amount || amount <= 0 || amount > 100000) {
    return c.json({ error: "Invalid amountUsd" }, 400);
  }
  try {
    const order = await createAuthorizeOrder(envMap, amount, body.description || "Aegis-402 escrow hold");
    return c.json(order);
  } catch (err) {
    const e = err as Error;
    return c.json({ error: e.message }, 502);
  }
});

// PayPal Orders v2: authorize an approved order → returns authorizationId (the lock)
app.post("/api/paypal/authorize-order", requireAuth, requireRole("BUYER"), async (c) => {
  const envMap = c.env as unknown as Record<string, string | undefined>;
  const body = (await c.req.json().catch(() => ({}))) as { orderId?: string };
  if (!body.orderId) return c.json({ error: "orderId is required" }, 400);
  try {
    const result = await authorizeOrder(envMap, body.orderId);
    return c.json(result);
  } catch (err) {
    const e = err as Error;
    return c.json({ error: e.message }, 502);
  }
});

// PayPal CAPTURE (Settle escrow & pay worker) — the buyer who funded the bounty.
// Full capture to business, then 5% platform cut stays + 95% Payouts leg to developer.
app.post("/api/bounties/:id/capture", requireAuth, requireRole("BUYER"), async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.creatorId && bounty.creatorId !== c.get("user").id) {
    return c.json({ error: "Only the buyer who funded this bounty can settle it" }, 403);
  }
  if (bounty.status !== "READY_FOR_REVIEW") {
    return c.json({ error: `Cannot capture a bounty in status ${bounty.status}` }, 409);
  }

  const envMap = c.env as unknown as Record<string, string | undefined>;
  const body = (await c.req.json().catch(() => ({}))) as { attestationHash?: string };
  const authId = bounty.payPalAuthorizationId || "";

  // Strict-live: no mock fallback. Demo or unconfigured bounties fail loudly.
  if (!authId || authId.startsWith("AUTH-")) {
    return c.json({ error: "Bounty has no live PayPal lock — demo bounties cannot settle" }, 422);
  }
  try {
    const result = await captureAuthorization(envMap, authId, body.attestationHash);
    bounty.status = "SETTLED";
    bounty.payPalCaptureId = result.captureId;
    bounty.settledAt = Date.now();

    // Resolve developer payout email. Agent claims store agentId in
    // workerUserId — resolve via the agent registry to the owner's user row.
    const { developerAmount, platformFee } = splitPayout(bounty.escrowAmount);
    let payoutEmail: string | null = null;
    try {
      const workerId = bounty.workerUserId || "";
      if (workerId.startsWith("agent-")) {
        const agentRows = await db.select().from(schema.agentKeyRecords).where(eq(schema.agentKeyRecords.id, workerId));
        const ownerId = agentRows.length > 0 ? (JSON.parse(agentRows[0].payload) as { ownerUserId?: string }).ownerUserId : null;
        if (ownerId) {
          const uRows = await db.select().from(schema.user).where(eq(schema.user.id, ownerId));
          const u = uRows[0] as unknown as Record<string, string | null> | undefined;
          payoutEmail = (u?.paypalEmail as string) || (u?.paypal_email as string) || (u?.email as string) || null;
        }
      } else if (workerId) {
        const uRows = await db.select().from(schema.user).where(eq(schema.user.id, workerId));
        const u = uRows[0] as unknown as Record<string, string | null> | undefined;
        payoutEmail = (u?.paypalEmail as string) || (u?.paypal_email as string) || (u?.email as string) || null;
      }
    } catch {
      payoutEmail = null;
    }

    let payoutBatchId: string | null = null;
    let payoutStatus = "SKIPPED_NO_PAYOUT_EMAIL";
    if (payoutEmail) {
      try {
        const batchId = `${bounty.id}-${result.captureId.slice(-8)}`.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 30);
        const payout = await createPayout(envMap as PayPalEnv, {
          toEmail: payoutEmail,
          amountUsd: developerAmount,
          batchId,
          note: `Aegis-402 payout for ${bounty.id} — approved by buyer`,
        });
        payoutBatchId = payout.batchId;
        payoutStatus = payout.status;
      } catch (err) {
        payoutStatus = `FAILED: ${(err as Error).message.slice(0, 200)}`;
      }
    }
    bounty.payoutBatchId = payoutBatchId || undefined;
    bounty.payoutStatus = payoutStatus;
    bounty.payoutTo = payoutEmail || undefined;
    bounty.platformFee = platformFee;
    bounty.developerPayout = developerAmount;

    // Settlement receipt: PayPal invoice to buyer (+ developer), capture
    // recorded as payment. Best-effort — never fails a settlement.
    let invoiceId: string | null = null;
    let invoiceStatus = "SKIPPED";
    try {
      const created = await createSettlementInvoice(envMap as PayPalEnv, {
        bountyId: bounty.id,
        bountyTitle: bounty.title,
        escrowAmount: bounty.escrowAmount,
        platformFee,
        developerAmount,
        captureId: result.captureId,
        buyerEmail: c.get("user").email,
        developerEmail: payoutEmail,
        attestationPrefix: body.attestationHash ? `AEGIS-${body.attestationHash.slice(0, 16).toUpperCase()}` : undefined,
      });
      invoiceId = created.invoiceId;
      invoiceStatus = created.status;
      try {
        await sendSettlementInvoice(envMap as PayPalEnv, invoiceId, payoutEmail);
        invoiceStatus = "SENT";
        try {
          await recordInvoicePayment(envMap as PayPalEnv, invoiceId, bounty.escrowAmount, result.captureId);
          invoiceStatus = "PAID";
        } catch {
          // sent but payment-record failed — receipt still valid
        }
      } catch {
        // draft exists but send failed — status stays DRAFT-ish
      }
    } catch {
      // invoicing unavailable — settlement stands without a receipt
    }
    bounty.invoiceId = invoiceId || undefined;
    bounty.invoiceStatus = invoiceStatus;
    await putBountyRecord(db, bounty);

    // Settlement ledger: capture leg + payout leg in one row (idempotent per bounty).
    try {
      await db.insert(schema.settlements).values({
        id: `stl-${bounty.id}`,
        bountyId: bounty.id,
        payPalOrderId: result.captureId,
        x402Preimage: payoutBatchId,
        amount: Math.round(developerAmount * 100),
        status: payoutBatchId ? "RELEASED" : "PENDING",
        createdAt: new Date(),
      }).onConflictDoNothing({ target: schema.settlements.id });
    } catch {
      // Ledger is best-effort — bounty state above is source of truth.
    }
    return c.json({
      status: "SETTLED",
      bountyId: bounty.id,
      payPalAuthorizationId: bounty.payPalAuthorizationId,
      payPalCaptureId: result.captureId,
      amountCaptured: `${bounty.escrowAmount.toFixed(2)} ${bounty.currency}`,
      developerPayout: `${developerAmount.toFixed(2)} ${bounty.currency}`,
      platformFee: `${platformFee.toFixed(2)} ${bounty.currency}`,
      payoutTo: payoutEmail,
      payoutBatchId,
      payoutStatus,
      invoiceId,
      invoiceStatus,
      live: true,
    });
  } catch (err) {
    const e = err as Error;
    return c.json({ error: e.message }, 502);
  }
});

// Retry developer payout — funder or the awaiting developer can re-fire the
// Payouts leg when it parked as FAILED/SKIPPED (e.g. Payouts not enabled at
// capture time, missing payout email since fixed). Refuses when a payout
// batch is already live to avoid double-paying.
app.post("/api/bounties/:id/retry-payout", requireAuth, async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "SETTLED") {
    return c.json({ error: `Bounty is ${bounty.status} — payouts retry only after settlement` }, 409);
  }
  const caller = c.get("user").id;
  if (bounty.creatorId !== caller && bounty.workerUserId !== caller) {
    return c.json({ error: "Only the funding buyer or the paid developer can retry the payout" }, 403);
  }
  const settled = (bounty.payoutStatus || "").toUpperCase();
  if (bounty.payoutBatchId && !settled.startsWith("FAILED") && !settled.startsWith("SKIPPED")) {
    return c.json({ error: `Payout already live (batch ${bounty.payoutBatchId}, status ${bounty.payoutStatus}) — refusing to double-pay`, payoutBatchId: bounty.payoutBatchId, payoutStatus: bounty.payoutStatus }, 409);
  }

  const envMap = c.env as unknown as Record<string, string | undefined>;
  const { developerAmount, platformFee } = splitPayout(bounty.escrowAmount);
  let payoutEmail: string | null = null;
  try {
    const workerId = bounty.workerUserId || "";
    if (workerId.startsWith("agent-")) {
      const agentRows = await db.select().from(schema.agentKeyRecords).where(eq(schema.agentKeyRecords.id, workerId));
      const ownerId = agentRows.length > 0 ? (JSON.parse(agentRows[0].payload) as { ownerUserId?: string }).ownerUserId : null;
      if (ownerId) {
        const uRows = await db.select().from(schema.user).where(eq(schema.user.id, ownerId));
        const u = uRows[0] as unknown as Record<string, string | null> | undefined;
        payoutEmail = (u?.paypalEmail as string) || (u?.paypal_email as string) || (u?.email as string) || null;
      }
    } else if (workerId) {
      const uRows = await db.select().from(schema.user).where(eq(schema.user.id, workerId));
      const u = uRows[0] as unknown as Record<string, string | null> | undefined;
      payoutEmail = (u?.paypalEmail as string) || (u?.paypal_email as string) || (u?.email as string) || null;
    }
  } catch {
    payoutEmail = null;
  }
  if (!payoutEmail) {
    return c.json({ error: "Developer has no payout email on file — ask them to set their PayPal payout address" }, 422);
  }
  try {
    const batchId = `${bounty.id}-retry-${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 30);
    const payout = await createPayout(envMap as PayPalEnv, {
      toEmail: payoutEmail,
      amountUsd: developerAmount,
      batchId,
      note: `Aegis-402 payout retry for ${bounty.id}`,
    });
    bounty.payoutBatchId = payout.batchId;
    bounty.payoutStatus = payout.status;
    bounty.payoutTo = payoutEmail;
    bounty.platformFee = platformFee;
    bounty.developerPayout = developerAmount;
    await putBountyRecord(db, bounty);
    try {
      await db
        .update(schema.settlements)
        .set({
          x402Preimage: payout.batchId,
          amount: Math.round(developerAmount * 100),
          status: "RELEASED",
        })
        .where(eq(schema.settlements.id, `stl-${bounty.id}`));
    } catch {
      // best-effort ledger
    }
    return c.json({
      status: "RELEASED",
      bountyId: bounty.id,
      payoutTo: payoutEmail,
      developerPayout: `${developerAmount.toFixed(2)} ${bounty.currency}`,
      payoutBatchId: payout.batchId,
      payoutStatus: payout.status,
    });
  } catch (err) {
    const e = err as Error;
    return c.json({ error: e.message }, 502);
  }
});

// Reject deliverable (free requeue) — escrow stays locked, bounty re-opens.
// Distinct from cancel/void: no money moves, rejected bytes are destroyed by the reaper.
app.post("/api/bounties/:id/reject", requireAuth, requireRole("BUYER"), async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.creatorId && bounty.creatorId !== c.get("user").id) {
    return c.json({ error: "Only the buyer who funded this bounty can reject it" }, 403);
  }
  if (bounty.status !== "READY_FOR_REVIEW") {
    return c.json({ error: `Cannot reject a bounty in status ${bounty.status}` }, 409);
  }
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
  const reason = String(body.reason || "").trim();
  if (reason.length < 10) {
    return c.json({ error: "Rejection reason required (min 10 chars) — shown to the next agent" }, 400);
  }
  bounty.status = "IN_PROGRESS";
  bounty.rejectionReason = reason.slice(0, 500);
  bounty.rejectedAt = Date.now();
  bounty.artifactSha256 = undefined;
  bounty.artifactByteSize = undefined;
  bounty.deliverableUrl = undefined;
  bounty.provisionError = undefined;
  bounty.latestProgress = "Reopened after buyer rejection — awaiting next submission";
  bounty.verificationSummary = undefined;
  bounty.leaseExpiresAt = Date.now() + 30 * 60 * 1000;
  await putBountyRecord(db, bounty);
  return c.json({ status: "IN_PROGRESS", bountyId: id, rejectionReason: bounty.rejectionReason });
});

// PayPal VOID (Cancel bounty & refund buyer) — the buyer who funded the bounty
app.post("/api/bounties/:id/void", requireAuth, requireRole("BUYER"), async (c) => {
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.creatorId && bounty.creatorId !== c.get("user").id) {
    return c.json({ error: "Only the buyer who funded this bounty can void it" }, 403);
  }
  if (bounty.status !== "READY_FOR_REVIEW" && bounty.status !== "IN_PROGRESS" && bounty.status !== "OPEN_FOR_CLAIM") {
    return c.json({ error: `Cannot void a bounty in status ${bounty.status}` }, 409);
  }

  const envMap = c.env as unknown as Record<string, string | undefined>;
  const authId = bounty.payPalAuthorizationId || "";

  // Strict-live: no mock fallback.
  if (!authId || authId.startsWith("AUTH-")) {
    return c.json({ error: "Bounty has no live PayPal lock — demo bounties cannot void" }, 422);
  }
  try {
    const attempted = (bounty.claimCount || 0) > 0 || bounty.checkpoints.length > 0 || (bounty.workerHistory || []).length > 0;
    let voidFee = 0;
    let refunded = bounty.escrowAmount;
    if (attempted) {
      // 1% cancellation fee: capture the fee leg, void the remaining 99%.
      // Pure VOID releases 100% — it cannot skim, so the fee must be captured first.
      voidFee = voidFeeFor(bounty.escrowAmount);
      refunded = Math.round((bounty.escrowAmount - voidFee) * 100) / 100;
      if (voidFee > 0) {
        await captureAuthorization(envMap, authId, `void-fee-${bounty.id}`.slice(0, 32), voidFee);
      }
    }
    await voidAuthorization(envMap, authId);
    bounty.status = "REFUNDED";
    bounty.voidFee = voidFee;
    await putBountyRecord(db, bounty);
    // Bytes live on the arbiter — its reaper destroys them immediately on REFUNDED.
    try {
      await db.insert(schema.settlements).values({
        id: `stl-void-${bounty.id}`,
        bountyId: bounty.id,
        payPalOrderId: authId,
        x402Preimage: voidFee > 0 ? `void-fee-${voidFee.toFixed(2)}` : null,
        amount: Math.round(refunded * 100),
        status: "REFUNDED",
        createdAt: new Date(),
      }).onConflictDoNothing({ target: schema.settlements.id });
    } catch {
      // best-effort ledger
    }
    return c.json({
      status: "REFUNDED",
      bountyId: bounty.id,
      payPalAuthorizationId: bounty.payPalAuthorizationId,
      amountRefunded: `${refunded.toFixed(2)} ${bounty.currency}`,
      voidFee: `${voidFee.toFixed(2)} ${bounty.currency}`,
      workAttempted: attempted,
      live: true,
    });
  } catch (err) {
    const e = err as Error;
    return c.json({ error: e.message }, 502);
  }
});

// Settlement ledger (scoped): settlements for bounties the caller funded,
// worked, or owns an agent key for. Powers the Audit dashboard source.
app.get("/api/settlements", requireAuth, async (c) => {
  const db = hubDb(c.env);
  const userId = c.get("user").id;
  const all = await getAllBountyRecords(db);
  let agentIds: string[] = [];
  try {
    agentIds = (await listAgents(db, userId)).map((a) => a.id);
  } catch {
    agentIds = [];
  }
  const visible = new Set(
    all
      .filter(
        (b) =>
          b.creatorId === userId ||
          b.workerUserId === userId ||
          (b.workerHistory || []).includes(userId) ||
          (b.workerHistory || []).some((w) => agentIds.includes(w)),
      )
      .map((b) => b.id),
  );
  if (visible.size === 0) return c.json([]);
  const rows = await db
    .select()
    .from(schema.settlements)
    .where(inArray(schema.settlements.bountyId, Array.from(visible)));
  return c.json(
    rows.map((r) => ({
      id: r.id,
      bountyId: r.bountyId,
      payPalOrderId: r.payPalOrderId,
      payoutBatchId: r.x402Preimage,
      amount: r.amount,
      status: r.status,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
    })),
  );
});

// AI chat relay for the Audit dashboard agent (server holds the model key).
// Env: AI_API_BASE (OpenAI-compatible, default api.openai.com/v1), AI_API_KEY, AI_MODEL.
// Request: AgLlmRequest-ish {input, instructions, tools, toolChoice, responseFormat}.
// Response: newline-delimited AgAiEvent JSON (TEXT_MESSAGE_CHUNK / TOOL_CALL_CHUNK).
app.post("/api/ai/chat", requireAuth, async (c) => {
  const envMap = c.env as unknown as Record<string, string | undefined>;
  const apiKey = envMap.AI_API_KEY;
  const apiBase = (envMap.AI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = envMap.AI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    return c.json({ error: "AI assistant not configured (AI_API_KEY). Ask your escrow anything once the owner adds a model key." }, 503);
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    input?: Array<Record<string, unknown>>;
    instructions?: string;
    tools?: Array<{ name: string; description: string; parameters: unknown; provider?: unknown; kind?: string }>;
    toolChoice?: string | { name?: string };
    responseFormat?: { type?: string };
  };

  const messages: Array<Record<string, unknown>> = [];
  if (body.instructions) messages.push({ role: "system", content: body.instructions });
  for (const item of body.input || []) {
    const kind = item.kind as string;
    const type = item.type as string;
    if (kind === "input" && type === "message") {
      const text = ((item.content as Array<{ type?: string; text?: string }> ) || [])
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text as string)
        .join("\n");
      if (text) messages.push({ role: item.role, content: text });
    } else if (kind === "output" && type === "message") {
      const text = ((item.content as Array<{ text?: string }>) || [])
        .map((p) => (typeof p.text === "string" ? p.text : ""))
        .join("");
      messages.push({ role: "assistant", content: text || null });
    } else if (type === "function_call") {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: item.callId,
            type: "function",
            function: { name: item.name, arguments: item.arguments || "{}" },
          },
        ],
      });
    } else if (type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: item.callId, content: String(item.output ?? "") });
    }
  }

  const tools = (body.tools || []).map((t) =>
    t.kind === "provided" && t.provider
      ? t.provider
      : { type: "function", function: { name: t.name, description: t.description, parameters: t.parameters || {} } },
  );
  let toolChoice: unknown = "auto";
  if (body.toolChoice === "none" || body.toolChoice === "required" || body.toolChoice === "auto") {
    toolChoice = body.toolChoice;
  } else if (body.toolChoice && typeof body.toolChoice === "object" && body.toolChoice.name) {
    toolChoice = { type: "function", function: { name: body.toolChoice.name } };
  }

  const upstream = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      ...(tools.length ? { tools, tool_choice: toolChoice } : {}),
      ...(body.responseFormat?.type === "json" ? { response_format: { type: "json_object" } } : {}),
      stream: true,
    }),
  }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    const text = upstream ? await upstream.text().catch(() => "") : "unreachable";
    return c.json({ error: `AI provider error: ${text.slice(0, 200)}` }, 502);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (ev: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(ev)}\n`));
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let textStarted = false;
      const msgId = `msg-${Date.now().toString(36)}`;
      const toolIds = new Map<number, string>();
      const toolEnded = new Set<string>();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const part of parts) {
            for (const line of part.split("\n")) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (payload === "[DONE]") continue;
              let evt: {
                choices?: Array<{
                  delta?: { content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> };
                }>;
              };
              try {
                evt = JSON.parse(payload);
              } catch {
                continue;
              }
              const delta = evt.choices?.[0]?.delta;
              if (!delta) continue;
              if (typeof delta.content === "string" && delta.content) {
                if (!textStarted) {
                  textStarted = true;
                  send({ type: "TEXT_MESSAGE_CHUNK", messageId: msgId, role: "assistant" });
                }
                send({ type: "TEXT_MESSAGE_CHUNK", delta: delta.content });
              }
              for (const tc of delta.tool_calls || []) {
                const idx = tc.index ?? 0;
                let callId = toolIds.get(idx);
                if (!callId && tc.id) {
                  callId = tc.id;
                  toolIds.set(idx, callId);
                }
                if (!callId) continue;
                if (tc.function?.name && !toolEnded.has(callId)) {
                  send({ type: "TOOL_CALL_CHUNK", toolCallId: callId, toolCallName: tc.function.name });
                }
                if (tc.function?.arguments) {
                  send({ type: "TOOL_CALL_CHUNK", toolCallId: callId, delta: tc.function.arguments });
                }
              }
            }
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
});

// Settlement ledger (scoped): settlements for bounties the caller funded,
// worked, or owns an agent key for. Powers the Audit dashboard source.
app.get("/api/settlements", requireAuth, async (c) => {
  const db = hubDb(c.env);
  const userId = c.get("user").id;
  const all = await getAllBountyRecords(db);
  let agentIds: string[] = [];
  try {
    agentIds = (await listAgents(db, userId)).map((a) => a.id);
  } catch {
    agentIds = [];
  }
  const visible = new Set(
    all
      .filter(
        (b) =>
          b.creatorId === userId ||
          b.workerUserId === userId ||
          (b.workerHistory || []).includes(userId) ||
          (b.workerHistory || []).some((w) => agentIds.includes(w)),
      )
      .map((b) => b.id),
  );
  if (visible.size === 0) return c.json([]);
  const rows = await db
    .select()
    .from(schema.settlements)
    .where(inArray(schema.settlements.bountyId, Array.from(visible)));
  return c.json(
    rows.map((r) => ({
      id: r.id,
      bountyId: r.bountyId,
      payPalOrderId: r.payPalOrderId,
      payoutBatchId: r.x402Preimage,
      amount: r.amount,
      status: r.status,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
    })),
  );
});

// AI chat relay for the Audit dashboard agent (server holds the model key).
// Env: AI_API_BASE (OpenAI-compatible, default api.openai.com/v1), AI_API_KEY, AI_MODEL.
// Request: AgLlmRequest-ish {input, instructions, tools, toolChoice, responseFormat}.
// Response: newline-delimited AgAiEvent JSON (TEXT_MESSAGE_CHUNK / TOOL_CALL_CHUNK).
app.post("/api/ai/chat", requireAuth, async (c) => {
  const envMap = c.env as unknown as Record<string, string | undefined>;
  const apiKey = envMap.AI_API_KEY;
  const apiBase = (envMap.AI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = envMap.AI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    return c.json({ error: "AI assistant not configured (AI_API_KEY). Ask your escrow anything once the owner adds a model key." }, 503);
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    input?: Array<Record<string, unknown>>;
    instructions?: string;
    tools?: Array<{ name: string; description: string; parameters: unknown; provider?: unknown; kind?: string }>;
    toolChoice?: string | { name?: string };
    responseFormat?: { type?: string };
  };

  const messages: Array<Record<string, unknown>> = [];
  if (body.instructions) messages.push({ role: "system", content: body.instructions });
  for (const item of body.input || []) {
    const kind = item.kind as string;
    const type = item.type as string;
    if (kind === "input" && type === "message") {
      const text = ((item.content as Array<{ type?: string; text?: string }>) || [])
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text as string)
        .join("\n");
      if (text) messages.push({ role: item.role, content: text });
    } else if (kind === "output" && type === "message") {
      const text = ((item.content as Array<{ text?: string }>) || [])
        .map((p) => (typeof p.text === "string" ? p.text : ""))
        .join("");
      messages.push({ role: "assistant", content: text || null });
    } else if (type === "function_call") {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: item.callId,
            type: "function",
            function: { name: item.name, arguments: item.arguments || "{}" },
          },
        ],
      });
    } else if (type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: item.callId, content: String(item.output ?? "") });
    }
  }

  const tools = (body.tools || []).map((t) =>
    t.kind === "provided" && t.provider
      ? t.provider
      : { type: "function", function: { name: t.name, description: t.description, parameters: t.parameters || {} } },
  );
  let toolChoice: unknown = "auto";
  if (body.toolChoice === "none" || body.toolChoice === "required" || body.toolChoice === "auto") {
    toolChoice = body.toolChoice;
  } else if (body.toolChoice && typeof body.toolChoice === "object" && body.toolChoice.name) {
    toolChoice = { type: "function", function: { name: body.toolChoice.name } };
  }

  const upstream = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      ...(tools.length ? { tools, tool_choice: toolChoice } : {}),
      ...(body.responseFormat?.type === "json" ? { response_format: { type: "json_object" } } : {}),
      stream: true,
    }),
  }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    const text = upstream ? await upstream.text().catch(() => "") : "unreachable";
    return c.json({ error: `AI provider error: ${text.slice(0, 200)}` }, 502);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (ev: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(ev)}\n`));
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let textStarted = false;
      const msgId = `msg-${Date.now().toString(36)}`;
      const toolIds = new Map<number, string>();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const part of parts) {
            for (const line of part.split("\n")) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (payload === "[DONE]") continue;
              let evt: {
                choices?: Array<{
                  delta?: { content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> };
                }>;
              };
              try {
                evt = JSON.parse(payload);
              } catch {
                continue;
              }
              const delta = evt.choices?.[0]?.delta;
              if (!delta) continue;
              if (typeof delta.content === "string" && delta.content) {
                if (!textStarted) {
                  textStarted = true;
                  send({ type: "TEXT_MESSAGE_CHUNK", messageId: msgId, role: "assistant" });
                }
                send({ type: "TEXT_MESSAGE_CHUNK", delta: delta.content });
              }
              for (const tc of delta.tool_calls || []) {
                const idx = tc.index ?? 0;
                let callId = toolIds.get(idx);
                if (!callId && tc.id) {
                  callId = tc.id;
                  toolIds.set(idx, callId);
                }
                if (!callId) continue;
                if (tc.function?.name) {
                  send({ type: "TOOL_CALL_CHUNK", toolCallId: callId, toolCallName: tc.function.name });
                }
                if (tc.function?.arguments) {
                  send({ type: "TOOL_CALL_CHUNK", toolCallId: callId, delta: tc.function.arguments });
                }
              }
            }
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
});

// Escrow lock verification: is the PayPal authorization actually live?
// Public (auth ids are already public via /api/bounties). Agents call this
// BEFORE spending compute. Mock AUTH-xxx seeds report verified:false.
app.get("/api/bounties/:id/escrow-status", async (c) => {
  const id = c.req.param("id");
  const bounty = await getBountyRecord(hubDb(c.env), id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  const base = {
    bountyId: id,
    escrowAmount: bounty.escrowAmount,
    currency: bounty.currency,
    payPalAuthorizationId: bounty.payPalAuthorizationId,
  };
  const authId = bounty.payPalAuthorizationId || "";
  if (authId.startsWith("AUTH-")) {
    return c.json({
      ...base,
      verified: false,
      mode: "DEMO",
      note: "Demo seed — no PayPal lock behind this bounty. Claim only to test mechanics.",
    });
  }
  const envMap = c.env as unknown as Record<string, string | undefined>;
  try {
    const live = await getAuthorizationStatus(envMap, authId);
    return c.json({
      ...base,
      verified: live.status === "CREATED" || live.status === "PENDING",
      mode: "LIVE",
      paypal: live,
    });
  } catch (err) {
    const e = err as Error;
    return c.json({ ...base, verified: false, mode: "ERROR", error: e.message }, 502);
  }
});

// Arbiter job queue: bounties awaiting sandbox provisioning.
app.get("/api/internal/bounties", async (c) => {
  const secret = c.req.header("x-referee-secret");
  const envMap = c.env as unknown as Record<string, string | undefined>;
  if (envMap.REFEREE_SECRET && secret !== envMap.REFEREE_SECRET) {
    return c.json({ error: "Unauthorized: Invalid referee secret" }, 401);
  }
  const status = c.req.query("status");
  const all = await getAllBountyRecords(hubDb(c.env));
  const filtered = status ? all.filter((b) => b.status === status) : all;
  return c.json(
    filtered.map((b) => ({
      bountyId: b.id,
      title: b.title,
      status: b.status,
      artifactSha256: b.artifactSha256,
      provisionStartedAt: b.provisionStartedAt,
      settledAt: b.settledAt,
    })),
  );
});

// Arbiter progress heartbeat during provisioning (buyer-visible).
app.post("/api/internal/bounties/:id/progress", async (c) => {
  const secret = c.req.header("x-referee-secret");
  const envMap = c.env as unknown as Record<string, string | undefined>;
  if (envMap.REFEREE_SECRET && secret !== envMap.REFEREE_SECRET) {
    return c.json({ error: "Unauthorized: Invalid referee secret" }, 401);
  }
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "PROVISIONING") return c.json({ error: `Bounty is ${bounty.status}, not provisioning` }, 409);
  const body = (await c.req.json().catch(() => ({}))) as { message?: string };
  bounty.latestProgress = String(body.message || "Working…").slice(0, 280);
  await putBountyRecord(db, bounty);
  return c.json({ status: "PROVISIONING", bountyId: id, latestProgress: bounty.latestProgress });
});

// Arbiter: sandbox ready + gates run → open buyer review.
app.post("/api/internal/bounties/:id/ready", async (c) => {
  const secret = c.req.header("x-referee-secret");
  const envMap = c.env as unknown as Record<string, string | undefined>;
  if (envMap.REFEREE_SECRET && secret !== envMap.REFEREE_SECRET) {
    return c.json({ error: "Unauthorized: Invalid referee secret" }, 401);
  }
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "PROVISIONING") return c.json({ error: `Bounty is ${bounty.status}, not provisioning` }, 409);
  const body = (await c.req.json().catch(() => ({}))) as {
    sandboxId?: string;
    artifactSha256?: string;
    gateSummary?: Record<string, unknown>;
  };
  if (body.artifactSha256 && bounty.artifactSha256 && body.artifactSha256 !== bounty.artifactSha256) {
    return c.json({ error: "Arbiter verified different bytes than the sealed vault — refusing" }, 422);
  }
  // Per-gate detail (why a verdict is REJECTED) is buyer- and agent-visible.
  // Cap the payload so D1 rows stay small; full logs stay on the arbiter.
  let gateDetail: Record<string, unknown> | undefined;
  try {
    const raw = JSON.stringify(body.gateSummary?.detail ?? null);
    if (raw && raw !== "null" && raw.length <= 12000) gateDetail = JSON.parse(raw) as Record<string, unknown>;
    else if (raw && raw !== "null") gateDetail = { truncated: true, preview: raw.slice(0, 2000) };
  } catch {
    gateDetail = undefined;
  }
  bounty.status = "READY_FOR_REVIEW";
  bounty.verificationSummary = {
    verdict: typeof body.gateSummary?.verdict === "string" ? body.gateSummary.verdict : undefined,
    artifactSha256: bounty.artifactSha256,
    sandboxId: body.sandboxId,
    completedAt: Date.now(),
    gateDetail,
  };
  bounty.latestProgress = undefined;
  await putBountyRecord(db, bounty);
  return c.json({ status: "READY_FOR_REVIEW", bountyId: id });
});

// Arbiter: provisioning failed → hand back to the agent with the error.
app.post("/api/internal/bounties/:id/failed", async (c) => {
  const secret = c.req.header("x-referee-secret");
  const envMap = c.env as unknown as Record<string, string | undefined>;
  if (envMap.REFEREE_SECRET && secret !== envMap.REFEREE_SECRET) {
    return c.json({ error: "Unauthorized: Invalid referee secret" }, 401);
  }
  const id = c.req.param("id");
  const db = hubDb(c.env);
  const bounty = await getBountyRecord(db, id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  if (bounty.status !== "PROVISIONING") return c.json({ error: `Bounty is ${bounty.status}, not provisioning` }, 409);
  const body = (await c.req.json().catch(() => ({}))) as { error?: string };
  bounty.status = "IN_PROGRESS";
  bounty.provisionError = String(body.error || "Sandbox provisioning failed").slice(0, 500);
  bounty.latestProgress = undefined;
  await putBountyRecord(db, bounty);
  return c.json({ status: "IN_PROGRESS", bountyId: id, provisionError: bounty.provisionError });
});

// Secure internal endpoint queried by Referee Server to resolve deliverable URLs
app.get("/api/internal/bounties/:id", async (c) => {
  const secret = c.req.header("x-referee-secret");
  const envMap = c.env as unknown as Record<string, string | undefined>;
  const expectedSecret = envMap.REFEREE_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return c.json({ error: "Unauthorized: Invalid referee secret" }, 401);
  }

  const id = c.req.param("id");
  const bounty = await getBountyRecord(hubDb(c.env), id);

  return c.json({
    bountyId: id,
    status: bounty?.status || "READY_FOR_REVIEW",
    type: "web",
    deliverableUrl: bounty?.deliverableUrl || "https://ayiba.dev",
    artifactPresent: Boolean(bounty?.artifactSha256),
    artifactSha256: bounty?.artifactSha256,
    openApiSpec: bounty?.openApiSpec ?? null,
    openApiSpecHash: bounty?.openApiSpecHash ?? null,
    settledAt: bounty?.settledAt,
  });
});

// (Removed: hub no longer stores code bytes. The arbiter holds the sealed
// tarball and serves buyer downloads via hub-issued signed URLs.)
// See: POST /api/bounties/:id/artifact (hash register) and
// GET /api/bounties/:id/artifact/download (signed URL issuance).

// SPA fallback (platform-independent): browser reloads and direct visits to
// client routes (/dashboard, /auth) must serve index.html. In-app navigation
// uses pushState and never hits the server, so only reloads expose this.
// Unknown /api/* paths keep a JSON 404 instead of leaking HTML.
app.get("*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }
  const assets = (c.env as unknown as { ASSETS?: Fetcher }).ASSETS;
  if (assets) {
    const res = await assets.fetch(new Request(new URL("/index.html", c.req.url)));
    if (res.ok) {
      return new Response(res.body, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }
  return c.text("Not Found", 404);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
