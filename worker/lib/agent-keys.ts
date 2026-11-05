/**
 * Per-agent API key registry for Aegis-402 MCP workers.
 *
 * D1-backed (survives worker restarts) with an in-memory fallback when no
 * database binding is available (e.g. unit tests). Only SHA-256 hashes are
 * stored; plaintext is returned exactly once at mint time.
 *
 * Key format: `aegis_sec_` + 32 hex chars.
 */

import { eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import type { HubDb } from "./store.ts";

export interface AgentRecord {
  id: string;
  name: string;
  framework: string;
  ownerUserId: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: number;
  revokedAt: number | null;
}

// In-memory fallback (used only when `db` is null).
const memRegistry = new Map<string, AgentRecord>(); // id -> record
const memHashIndex = new Map<string, string>(); // keyHash -> id

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface MintedAgent {
  id: string;
  name: string;
  framework: string;
  apiKey: string;
  keyPrefix: string;
  createdAt: number;
}

/** Mint a new agent key for a developer. Plaintext is returned ONCE. */
export async function mintAgentKey(
  db: HubDb | null,
  ownerUserId: string,
  name: string,
  framework: string,
): Promise<MintedAgent> {
  const apiKey = `aegis_sec_${randomHex(16)}`;
  const keyHash = await sha256Hex(apiKey);
  const record: AgentRecord = {
    id: `agent-${Date.now().toString(36)}${randomHex(3)}`,
    name,
    framework,
    ownerUserId,
    keyHash,
    keyPrefix: apiKey.slice(0, 12),
    createdAt: Date.now(),
    revokedAt: null,
  };
  if (db) {
    await db.insert(schema.agentKeyRecords).values({
      id: record.id,
      ownerUserId,
      keyHash,
      payload: JSON.stringify(record),
      updatedAt: new Date(),
    });
  } else {
    memRegistry.set(record.id, record);
    memHashIndex.set(keyHash, record.id);
  }
  return {
    id: record.id,
    name,
    framework,
    apiKey,
    keyPrefix: record.keyPrefix,
    createdAt: record.createdAt,
  };
}

export interface ValidatedAgent {
  agentId: string;
  name: string;
  framework: string;
  ownerUserId: string;
}

/** Validate a presented plaintext key. Returns agent identity or null. */
export async function validateAgentKey(
  db: HubDb | null,
  plaintext: string,
): Promise<ValidatedAgent | null> {
  if (!plaintext || !plaintext.startsWith("aegis_sec_")) return null;
  const keyHash = await sha256Hex(plaintext);
  let record: AgentRecord | undefined;
  if (db) {
    const rows = await db
      .select()
      .from(schema.agentKeyRecords)
      .where(eq(schema.agentKeyRecords.keyHash, keyHash));
    if (rows.length === 0) return null;
    record = JSON.parse(rows[0].payload) as AgentRecord;
  } else {
    const id = memHashIndex.get(keyHash);
    if (!id) return null;
    record = memRegistry.get(id);
  }
  if (!record || record.revokedAt !== null) return null;
  return {
    agentId: record.id,
    name: record.name,
    framework: record.framework,
    ownerUserId: record.ownerUserId,
  };
}

export interface AgentSummary {
  id: string;
  name: string;
  framework: string;
  keyPrefix: string;
  createdAt: number;
  revoked: boolean;
}

/** List a developer's agents (metadata only — never plaintext). */
export async function listAgents(
  db: HubDb | null,
  ownerUserId: string,
): Promise<AgentSummary[]> {
  let records: AgentRecord[];
  if (db) {
    const rows = await db
      .select()
      .from(schema.agentKeyRecords)
      .where(eq(schema.agentKeyRecords.ownerUserId, ownerUserId));
    records = rows.map((r) => JSON.parse(r.payload) as AgentRecord);
  } else {
    records = Array.from(memRegistry.values()).filter(
      (r) => r.ownerUserId === ownerUserId,
    );
  }
  return records
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({
      id: r.id,
      name: r.name,
      framework: r.framework,
      keyPrefix: r.keyPrefix,
      createdAt: r.createdAt,
      revoked: r.revokedAt !== null,
    }));
}

/** Revoke an agent key. Returns false if not found / not owned. */
export async function revokeAgent(
  db: HubDb | null,
  ownerUserId: string,
  agentId: string,
): Promise<boolean> {
  if (db) {
    const rows = await db
      .select()
      .from(schema.agentKeyRecords)
      .where(eq(schema.agentKeyRecords.id, agentId));
    if (rows.length === 0) return false;
    const record = JSON.parse(rows[0].payload) as AgentRecord;
    if (record.ownerUserId !== ownerUserId) return false;
    if (record.revokedAt !== null) return true;
    record.revokedAt = Date.now();
    // Keep the row (revoked metadata stays listable) but tombstone the hash
    // lookup so the plaintext key stops validating.
    await db
      .update(schema.agentKeyRecords)
      .set({
        keyHash: `revoked-${record.id}-${Date.now()}`,
        payload: JSON.stringify(record),
        updatedAt: new Date(),
      })
      .where(eq(schema.agentKeyRecords.id, agentId));
    return true;
  }
  const record = memRegistry.get(agentId);
  if (!record || record.ownerUserId !== ownerUserId) return false;
  if (record.revokedAt !== null) return true;
  record.revokedAt = Date.now();
  memHashIndex.delete(record.keyHash);
  return true;
}

/**
 * True when the agent exists, is not revoked, and belongs to ownerUserId.
 * Used for claim-as-agent and owner-or-agent lease enforcement. False on
 * any error or mismatch — never leaks which condition failed.
 */
export async function ownsAgent(
  db: HubDb | null,
  ownerUserId: string,
  agentId: string,
): Promise<boolean> {
  if (!ownerUserId || !agentId) return false;
  try {
    if (db) {
      const rows = await db
        .select()
        .from(schema.agentKeyRecords)
        .where(eq(schema.agentKeyRecords.id, agentId));
      if (rows.length === 0) return false;
      const record = JSON.parse(rows[0].payload) as AgentRecord;
      return record.ownerUserId === ownerUserId && record.revokedAt === null;
    }
    const record = memRegistry.get(agentId);
    return (
      !!record &&
      record.ownerUserId === ownerUserId &&
      record.revokedAt === null
    );
  } catch {
    return false;
  }
}
