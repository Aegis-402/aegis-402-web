import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth.ts";
import { validateAgentKey } from "./agent-keys.ts";
import { hubDb } from "./store.ts";
import type { AppEnv } from "./middleware.ts";

/**
 * Agent service authentication for MCP/CLI workers.
 *
 * Accepts, in order:
 *  1. Per-agent key (`aegis_sec_...` minted via POST /api/agents) in the
 *     `x-agent-key` header → identity = that registered agent.
 *     Lease ownership is enforced per agent id downstream.
 *  2. Legacy `AGENT_API_KEY` bootstrap secret (demo fallback) → synthetic
 *     shared DEVELOPER identity. Remove after migrating to per-agent keys.
 *  3. A normal Better Auth session cookie with role DEVELOPER (humans).
 */
export const requireDeveloperOrAgent = createMiddleware<AppEnv>(async (c, next) => {
  const envMap = c.env as unknown as Record<string, string | undefined>;
  const provided = c.req.header("x-agent-key");

  // 1. Per-agent key (registered via dashboard)
  if (provided && provided.startsWith("aegis_sec_")) {
    let agent = null;
    try {
      agent = await validateAgentKey(hubDb(c.env), provided);
    } catch {
      agent = await validateAgentKey(null, provided);
    }
    if (agent) {
      c.set("user", {
        id: agent.agentId,
        email: `${agent.agentId}@agents.aegis-402.local`,
        name: agent.name,
        role: "DEVELOPER",
        paypalEmail: null,
      });
      await next();
      return;
    }
    return c.json({ error: "Invalid or revoked agent key" }, 401);
  }

  // 2. Legacy bootstrap service key (demo fallback)
  const expected = envMap.AGENT_API_KEY;
  if (expected && provided && provided === expected) {
    c.set("user", {
      id: "agent-mcp-service",
      email: "agent@aegis-402.local",
      name: "MCP Service Agent",
      role: "DEVELOPER",
      paypalEmail: null,
    });
    await next();
    return;
  }

  // Fall back to human session auth
  const auth = createAuth(c.env as never, c.req.url);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Authentication required (session or x-agent-key)" }, 401);
  }
  const u = session.user as unknown as AppEnv["Variables"]["user"];
  if (u.role !== "DEVELOPER") {
    return c.json({ error: "Requires role: DEVELOPER" }, 403);
  }
  c.set("user", {
    id: u.id,
    email: u.email,
    name: u.name,
    role: "DEVELOPER",
    paypalEmail: u.paypalEmail ?? null,
  });
  await next();
});
