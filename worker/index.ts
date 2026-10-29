import { Hono } from "hono";
import { createAuth } from "./lib/auth.ts";

const app = new Hono<{ Bindings: Env }>();

// In-memory bounty store for live demo & hackathon evaluation
interface BountyRecord {
  id: string;
  title: string;
  description: string;
  escrowAmount: number;
  currency: string;
  status: "OPEN_FOR_CLAIM" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "SETTLED" | "REFUNDED";
  category: "Web App" | "API / Backend" | "AI Agent Tool";
  payPalAuthorizationId?: string;
  payPalCaptureId?: string;
  workerAgentId?: string;
  leaseToken?: string;
  leaseExpiresAt?: number;
  deliverableUrl?: string;
  testsPassed: number;
  testsTotal: number;
  currentStage: "SCAFFOLDING" | "CORE_LOGIC" | "TESTING" | "FINAL_POLISH";
  checkpoints: Array<{
    stage: string;
    summary: string;
    testsPassed: number;
    testsTotal: number;
    timestamp: number;
  }>;
  createdAt: number;
}

const mockBounties: BountyRecord[] = [
  {
    id: "bounty-paypal-402",
    title: "PayPal x402 Micro-Settlement Flow & Webhook Gate",
    description: "Build an interactive escrow checkout flow with HTTP 402 payment authorization, instant refund handling, and Playwright CDP zero-leak review compatibility.",
    escrowAmount: 250.0,
    currency: "USD",
    status: "READY_FOR_REVIEW",
    category: "Web App",
    payPalAuthorizationId: "AUTH-8921-PAYPAL-402",
    workerAgentId: "agent-mcp-claude",
    leaseToken: "lease-h4819k",
    leaseExpiresAt: Date.now() + 12 * 60 * 1000,
    deliverableUrl: "https://ayiba.dev",
    testsPassed: 14,
    testsTotal: 14,
    currentStage: "FINAL_POLISH",
    checkpoints: [
      { stage: "SCAFFOLDING", summary: "Initialized Vite React 19 + Hono router", testsPassed: 4, testsTotal: 4, timestamp: Date.now() - 30 * 60000 },
      { stage: "CORE_LOGIC", summary: "Implemented PayPal Orders v2 AUTHORIZE state machine", testsPassed: 10, testsTotal: 12, timestamp: Date.now() - 15 * 60000 },
      { stage: "TESTING", summary: "All edge-cases and webhook callbacks passing", testsPassed: 14, testsTotal: 14, timestamp: Date.now() - 5 * 60000 },
    ],
    createdAt: Date.now() - 60 * 60000,
  },
  {
    id: "bounty-apimatic-sdk",
    title: "APIMatic OpenAPI 3.0 Contract Fuzzing & Client SDK",
    description: "Generate and validate APIMatic OpenAPI client library with strict schema contract validation and latency SLA benchmarking.",
    escrowAmount: 350.0,
    currency: "USD",
    status: "IN_PROGRESS",
    category: "API / Backend",
    payPalAuthorizationId: "AUTH-5412-APIMATIC-99",
    workerAgentId: "agent-mcp-cursor",
    leaseToken: "lease-c9182x",
    leaseExpiresAt: Date.now() + 9 * 60 * 1000,
    testsPassed: 8,
    testsTotal: 10,
    currentStage: "CORE_LOGIC",
    checkpoints: [
      { stage: "SCAFFOLDING", summary: "Generated APIMatic OpenAPI definitions", testsPassed: 4, testsTotal: 4, timestamp: Date.now() - 20 * 60000 },
      { stage: "CORE_LOGIC", summary: "Contract fuzzing 80% passing", testsPassed: 8, testsTotal: 10, timestamp: Date.now() - 6 * 60000 },
    ],
    createdAt: Date.now() - 40 * 60000,
  },
  {
    id: "bounty-referee-canvas",
    title: "Playwright CDP Low-Latency WebP Viewport Streamer",
    description: "Build an isolated headless browser streaming buffer that captures binary WebP frames at 60 FPS without leaking underlying DOM nodes or URLs.",
    escrowAmount: 500.0,
    currency: "USD",
    status: "OPEN_FOR_CLAIM",
    category: "AI Agent Tool",
    payPalAuthorizationId: "AUTH-1092-CDP-STREAM",
    testsPassed: 0,
    testsTotal: 18,
    currentStage: "SCAFFOLDING",
    checkpoints: [],
    createdAt: Date.now() - 10 * 60000,
  },
];

// Better Auth endpoint handler
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
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

// List Bounties
app.get("/api/bounties", (c) => {
  return c.json(mockBounties);
});

// Get Single Bounty
app.get("/api/bounties/:id", (c) => {
  const id = c.req.param("id");
  const bounty = mockBounties.find((b) => b.id === id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);
  return c.json(bounty);
});

// Post a new bounty with pre-authorized PayPal Escrow
app.post("/api/bounties", async (c) => {
  const body = await c.req.json();
  const id = `bounty-${Math.random().toString(36).substring(2, 9)}`;
  const newBounty: BountyRecord = {
    id,
    title: body.title || "Custom Autonomous Bounty",
    description: body.description || "Deliverable specification secured by Aegis-402 PayPal Escrow.",
    escrowAmount: parseFloat(body.escrowAmount) || 250.0,
    currency: "USD",
    status: "OPEN_FOR_CLAIM",
    category: body.category || "Web App",
    payPalAuthorizationId: body.payPalAuthorizationId || `AUTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    testsPassed: 0,
    testsTotal: 10,
    currentStage: "SCAFFOLDING",
    checkpoints: [],
    createdAt: Date.now(),
  };

  mockBounties.unshift(newBounty);
  return c.json(newBounty, 201);
});

// Claim lease (called by worker agents or MCP server)
app.post("/api/bounties/:id/claim", async (c) => {
  const id = c.req.param("id");
  const bounty = mockBounties.find((b) => b.id === id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as { agentId?: string };
  const leaseToken = `lease-${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;

  bounty.status = "IN_PROGRESS";
  bounty.workerAgentId = body.agentId || "agent-mcp-worker";
  bounty.leaseToken = leaseToken;
  bounty.leaseExpiresAt = expiresAt;

  return c.json({
    bountyId: bounty.id,
    leaseToken,
    expiresAt,
    status: "ACTIVE",
  });
});

// Push checkpoint
app.post("/api/bounties/:id/checkpoints", async (c) => {
  const id = c.req.param("id");
  const bounty = mockBounties.find((b) => b.id === id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);

  const body = await c.req.json();
  const chk = {
    stage: body.stage || "CORE_LOGIC",
    summary: body.summary || "Progress checkpoint",
    testsPassed: body.testsPassed ?? bounty.testsPassed,
    testsTotal: body.testsTotal ?? bounty.testsTotal,
    timestamp: Date.now(),
  };

  bounty.checkpoints.push(chk);
  bounty.testsPassed = chk.testsPassed;
  bounty.testsTotal = chk.testsTotal;
  bounty.currentStage = chk.stage;
  bounty.leaseExpiresAt = Date.now() + 15 * 60 * 1000; // renew lease

  return c.json({ status: "RECORDED", checkpoint: chk, leaseExpiresAt: bounty.leaseExpiresAt });
});

// Submit deliverable URL
app.post("/api/bounties/:id/deliver", async (c) => {
  const id = c.req.param("id");
  const bounty = mockBounties.find((b) => b.id === id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);

  const body = await c.req.json();
  bounty.status = "READY_FOR_REVIEW";
  bounty.deliverableUrl = body.deliverableUrl || "https://ayiba.dev";

  return c.json({
    status: "READY_FOR_REVIEW",
    bountyId: bounty.id,
    deliverableUrl: bounty.deliverableUrl,
  });
});

// PayPal CAPTURE (Settle escrow & pay worker)
app.post("/api/bounties/:id/capture", async (c) => {
  const id = c.req.param("id");
  const bounty = mockBounties.find((b) => b.id === id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);

  const captureId = `CAPTURE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  bounty.status = "SETTLED";
  bounty.payPalCaptureId = captureId;

  return c.json({
    status: "SETTLED",
    bountyId: bounty.id,
    payPalAuthorizationId: bounty.payPalAuthorizationId,
    payPalCaptureId: captureId,
    amountCaptured: `${bounty.escrowAmount.toFixed(2)} ${bounty.currency}`,
    decryptionKey: `aegis-key-${Math.random().toString(36).substring(2, 16)}`,
  });
});

// PayPal VOID (Reject & refund buyer)
app.post("/api/bounties/:id/void", async (c) => {
  const id = c.req.param("id");
  const bounty = mockBounties.find((b) => b.id === id);
  if (!bounty) return c.json({ error: "Bounty not found" }, 404);

  bounty.status = "REFUNDED";

  return c.json({
    status: "REFUNDED",
    bountyId: bounty.id,
    payPalAuthorizationId: bounty.payPalAuthorizationId,
    amountRefunded: `${bounty.escrowAmount.toFixed(2)} ${bounty.currency}`,
  });
});

// Secure internal endpoint queried by Referee Server to resolve deliverable URLs
app.get("/api/internal/bounties/:id", (c) => {
  const secret = c.req.header("x-referee-secret");
  const envMap = c.env as unknown as Record<string, string | undefined>;
  const expectedSecret = envMap.REFEREE_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return c.json({ error: "Unauthorized: Invalid referee secret" }, 401);
  }

  const id = c.req.param("id");
  const bounty = mockBounties.find((b) => b.id === id);

  return c.json({
    bountyId: id,
    status: bounty?.status || "READY_FOR_REVIEW",
    type: "web",
    deliverableUrl: bounty?.deliverableUrl || "https://ayiba.dev",
  });
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
