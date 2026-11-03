import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";

export interface AuthEnv {
  aegis_db: D1Database;
  BETTER_AUTH_SECRET?: string;
}

/**
 * The Worker serves both the SPA and the API from the same origin, so the base URL and the
 * only trusted origin are derived from the incoming request. Cross-origin requests are still
 * rejected by Better Auth's origin check (CSRF protection stays on).
 */
export function createAuth(env: AuthEnv, requestUrl: string) {
  const db = drizzle(env.aegis_db);
  const origin = new URL(requestUrl).origin;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET || "aegis-402-dev-secret-change-in-production",
    baseURL: origin,
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "DEVELOPER",
          input: true,
        },
        paypalEmail: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
