import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth.ts";

export type Role = "BUYER" | "DEVELOPER";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  paypalEmail?: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { user: AuthUser };
};

/** Resolves the Better Auth session from cookies; 401 if missing/invalid. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const auth = createAuth(c.env, c.req.url);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const u = session.user as unknown as AuthUser;
  c.set("user", {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role === "BUYER" ? "BUYER" : "DEVELOPER",
    paypalEmail: u.paypalEmail ?? null,
  });
  await next();
});

/** Must run after requireAuth. 403 if the user's role is not allowed. */
export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("user").role)) {
      return c.json({ error: `Requires role: ${roles.join(" or ")}` }, 403);
    }
    await next();
  });
