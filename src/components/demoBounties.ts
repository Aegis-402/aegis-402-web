import type { Bounty } from "../types";

/** Deterministic PRNG — same demo board every render, stable memo sigs. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_TITLES = [
  "landing page copy",
  "checkout webhook",
  "sandbox boot",
  "invoice export",
  "docs polish",
  "auth middleware",
  "settlement cron",
  "lease heartbeat",
  "review queue filter",
  "escrow chart drill",
  "payout retry",
  "refund sweep",
  "agent lease renew",
  "cache headers",
  "rate limiter",
  "audit CSV export",
  "timeline zoom",
  "status pills",
  "onboarding flow",
  "mobile nav",
];

const DEMO_CATEGORIES = ["Web App", "API / Backend", "AI Agent Tool"] as const;

const DEMO_STATUS_POOL = [
  ...Array(20).fill("OPEN_FOR_CLAIM"),
  ...Array(25).fill("IN_PROGRESS"),
  ...Array(10).fill("PROVISIONING"),
  ...Array(20).fill("READY_FOR_REVIEW"),
  ...Array(15).fill("SETTLED"),
  ...Array(10).fill("REFUNDED"),
] as Bounty["status"][];

const LEASE_MS = 30 * 60 * 1000;
const STAGES = ["SCAFFOLDING", "CORE_LOGIC", "TESTING", "FINAL_POLISH"];

/** Demo rows (demo-*): static, never touch the API. 100 rows covering every
 *  verdict color, with staggered lease timestamps (spread over the last ~5h
 *  so timeline bars don't stack on "now") and synthesized checkpoints. */
function buildDemoBounties(): Bounty[] {
  const rand = mulberry32(402);
  const now = Date.now();
  return DEMO_STATUS_POOL.map((status, i) => {
    const n = String(i + 1).padStart(3, "0");
    const title = `Demo: ${DEMO_TITLES[i % DEMO_TITLES.length]} ${n}`;
    const escrowAmount = 5 + Math.floor(rand() * 196);
    const claimed = status !== "OPEN_FOR_CLAIM";
    const settled = status === "SETTLED";
    const refunded = status === "REFUNDED";
    // Stagger lease windows over the last ~5h so the timeline spreads out.
    const leaseExpiresAt = claimed
      ? now - (i % 25) * 12 * 60 * 1000
      : undefined;
    const provisionStartedAt = claimed
      ? (leaseExpiresAt as number) - LEASE_MS
      : undefined;
    const finishedAt =
      settled || refunded || status === "READY_FOR_REVIEW"
        ? now - (i % 15) * 20 * 60 * 1000
        : undefined;
    // 3 checkpoints spread across the lease window for claimed bounties.
    const checkpoints =
      claimed && provisionStartedAt && leaseExpiresAt
        ? [0.25, 0.5, 0.75].map((f, k) => ({
            stage: STAGES[Math.min(k, STAGES.length - 1)],
            summary: `Demo checkpoint ${k + 1} of 3`,
            testsPassed: 1 + k,
            testsTotal: 5,
            timestamp: Math.round(
              provisionStartedAt +
                f * (leaseExpiresAt - provisionStartedAt)
            ),
          }))
        : undefined;
    return {
      id: `demo-bounty-${n}`,
      title,
      description: "demo",
      escrowAmount,
      currency: "USD",
      status,
      category: DEMO_CATEGORIES[i % DEMO_CATEGORIES.length],
      workerAgentId: claimed ? `demo-agent-${(i % 4) + 1}` : undefined,
      payPalAuthorizationId: claimed ? `DEMOAUTH${n}` : undefined,
      payPalCaptureId: settled ? `DEMOCAPT${n}` : undefined,
      payoutStatus: settled
        ? "SENT"
        : refunded
          ? "VOIDED"
          : claimed
            ? "PENDING"
            : undefined,
      invoiceStatus: settled ? "SENT" : undefined,
      developerPayout: settled
        ? Math.round(escrowAmount * 0.95 * 100) / 100
        : undefined,
      platformFee: settled
        ? Math.round(escrowAmount * 0.05 * 100) / 100
        : undefined,
      leaseExpiresAt,
      provisionStartedAt,
      settledAt: settled || refunded ? finishedAt : undefined,
      verificationSummary:
        status === "READY_FOR_REVIEW" && finishedAt
          ? { completedAt: finishedAt }
          : undefined,
      checkpoints,
      testsPassed: settled ? 5 : Math.floor(rand() * 5),
      testsTotal: 5,
      currentStage: settled
        ? "DONE"
        : status === "OPEN_FOR_CLAIM"
          ? "QUEUED"
          : "CORE_LOGIC",
      claimCount: status === "OPEN_FOR_CLAIM" ? 0 : 1 + (i % 3),
    } satisfies Bounty;
  });
}

export const DEMO_BOUNTIES: Bounty[] = buildDemoBounties();
