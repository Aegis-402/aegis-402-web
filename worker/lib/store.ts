import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";

export type HubDb = ReturnType<typeof drizzle>;

export function hubDb(env: unknown): HubDb {
  const aegisDb = (env as Record<string, unknown>).aegis_db;
  // Plain table selects/inserts (no relational queries), so no schema
  // registration is needed — table objects are passed explicitly per query.
  return drizzle(aegisDb as never);
}

// ---------------------------------------------------------------------------
// Bounty records (D1-backed; JSON payload preserves the full runtime shape)
// ---------------------------------------------------------------------------

export interface BountyCheckpoint {
  stage: string;
  summary: string;
  testsPassed: number;
  testsTotal: number;
  timestamp: number;
}

export interface BountyRecord {
  id: string;
  title: string;
  description: string;
  escrowAmount: number;
  currency: string;
  status: "OPEN_FOR_CLAIM" | "IN_PROGRESS" | "PROVISIONING" | "READY_FOR_REVIEW" | "SETTLED" | "REFUNDED";
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
  checkpoints: BountyCheckpoint[];
  createdAt: number;
  creatorId?: string;
  workerUserId?: string;
  /** Hex sha256 of the plaintext code tarball (bytes live on the arbiter, never the hub). */
  artifactSha256?: string;
  artifactByteSize?: number;
  /** Arbiter sandbox lifecycle (PROVISIONING phase). */
  provisionStartedAt?: number;
  provisionError?: string;
  latestProgress?: string;
  verificationSummary?: {
    verdict?: string;
    artifactSha256?: string;
    sandboxId?: string;
    completedAt?: number;
    /** Compact per-gate breakdown (scores + failing items, capped). */
    gateDetail?: Record<string, unknown>;
  };
  /** Attempt tracking: incremented on every successful claim. Drives the 1% void fee. */
  claimCount?: number;
  workerHistory?: string[];
  rejectionReason?: string;
  rejectedAt?: number;
  /** Structured bounty spec (P1 fleshed-out form). */
  problemStatement?: string;
  requirements?: string[];
  acceptanceCriteria?: string[];
  techConstraints?: string;
  timeline?: string;
  referenceLinks?: string[];
  /**
   * Buyer-attached OpenAPI contract (source of truth for contract gates).
   * Normalized OpenAPI 3.x JSON (≤100KB). Required for "API / Backend"
   * bounties, optional otherwise. Immutable: no update route mutates it,
   * so the contract a worker claims against is the contract it is graded on.
   * The full blob is stripped from public list/detail views — fetch via
   * GET /api/bounties/:id/openapi. Tarball specs are ignored by the arbiter.
   */
  openApiSpec?: string;
  openApiSpecHash?: string;
  openApiEndpointCount?: number;
  /** Settlement ledger (5% platform fee on capture, 1% void fee when attempted). */
  settledAt?: number;
  payoutBatchId?: string;
  payoutStatus?: string;
  payoutTo?: string;
  platformFee?: number;
  developerPayout?: number;
  invoiceId?: string;
  invoiceStatus?: string;
  voidFee?: number;
}

/** No demo seeds. Every bounty must carry a real PayPal authorization id. */
export function seedBounties(): BountyRecord[] {
  return [];
}

export async function getAllBountyRecords(db: HubDb): Promise<BountyRecord[]> {
  const rows = await db.select().from(schema.bountyRecords);
  return rows.map((r) => JSON.parse(r.payload) as BountyRecord);
}

export async function getBountyRecord(db: HubDb, id: string): Promise<BountyRecord | null> {
  const rows = await db.select().from(schema.bountyRecords).where(eq(schema.bountyRecords.id, id));
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].payload) as BountyRecord;
}

export async function putBountyRecord(db: HubDb, b: BountyRecord): Promise<void> {
  await db
    .insert(schema.bountyRecords)
    .values({
      id: b.id,
      status: b.status,
      creatorId: b.creatorId ?? null,
      payload: JSON.stringify(b),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.bountyRecords.id,
      set: {
        status: b.status,
        creatorId: b.creatorId ?? null,
        payload: JSON.stringify(b),
        updatedAt: new Date(),
      },
    });
}
