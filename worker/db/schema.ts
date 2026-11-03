import { defineRelationsPart } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ==========================================
// Better Auth Core Tables
// ==========================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  role: text("role", { enum: ["BUYER", "DEVELOPER"] })
    .default("DEVELOPER")
    .notNull(),
  paypalEmail: text("paypal_email"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// Better Auth relations
export const authRelations = defineRelationsPart(
  { user, session, account, verification },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),
      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
  })
);

// ==========================================
// Aegis-402 Core Tables
// ==========================================

export const bounties = sqliteTable(
  "bounties",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    amount: integer("amount").notNull(), // stored in cents/sats
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("OPEN"), // OPEN, LEASED, SUBMITTED, VERIFYING, VERIFIED, SETTLED, EXPIRED
    type: text("type").notNull().default("web"), // web, api, code
    deliverableUrl: text("deliverable_url"), // secret preview target resolved only by Referee
    creatorId: text("creator_id").references(() => user.id, {
      onDelete: "set null",
    }),
    hunterId: text("hunter_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("bounties_creator_idx").on(table.creatorId)]
);

export const bountyLeases = sqliteTable(
  "bounty_leases",
  {
    id: text("id").primaryKey(),
    bountyId: text("bounty_id")
      .notNull()
      .references(() => bounties.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    leaseToken: text("lease_token").notNull().unique(),
    heartbeatAt: integer("heartbeat_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("leases_bounty_idx").on(table.bountyId)]
);

export const settlements = sqliteTable(
  "settlements",
  {
    id: text("id").primaryKey(),
    bountyId: text("bounty_id")
      .notNull()
      .references(() => bounties.id, { onDelete: "cascade" }),
    payPalOrderId: text("paypal_order_id"),
    x402Preimage: text("x402_preimage"),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING, ESCROWED, RELEASED, REFUNDED
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("settlements_bounty_idx").on(table.bountyId)]
);

// ==========================================
// Aegis-402 Runtime Persistence (D1-backed)
// ==========================================
// The Hub's live bounty + agent-key state is stored as JSON payloads so the
// full BountyRecord shape (lease tokens, checkpoints, PayPal auth ids)
// survives worker restarts. Queryable columns cover list/filter needs.

export const bountyRecords = sqliteTable(
  "bounty_records",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull(),
    creatorId: text("creator_id"),
    payload: text("payload").notNull(), // full BountyRecord JSON
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("bounty_records_status_idx").on(table.status)]
);

export const agentKeyRecords = sqliteTable(
  "agent_key_records",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    payload: text("payload").notNull(), // AgentRecord JSON (hash only, never plaintext)
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("agent_key_records_owner_idx").on(table.ownerUserId),
    index("agent_key_records_hash_idx").on(table.keyHash),
  ]
);

// NOTE: no code bytes are stored in D1 (free-tier friendly). The hub keeps
// only the tarball sha256; bytes live on the arbiter, buyer downloads go
// browser → arbiter via hub-issued signed URLs.
