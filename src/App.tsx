import { useState, useEffect, useRef } from "react";
import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { TrustBar } from "./components/TrustBar";
import { FeatureSplitSection } from "./components/FeatureSplitSection";
import { MidnightMcpSection } from "./components/MidnightMcpSection";
import { WhyAegisSection } from "./components/WhyAegisSection";
import { BountyCard } from "./components/BountyCard";
import { PreFooterCta } from "./components/PreFooterCta";
import { Footer } from "./components/Footer";
import { ZeroLeakCanvasModal } from "./components/ZeroLeakCanvasModal";
import { PostBountyModal } from "./components/PostBountyModal";
import { AuthScreen, type UserSession } from "./components/AuthScreen";
import { authClient } from "./lib/auth-client";
import { DashboardScreen } from "./components/DashboardScreen";
import { Toaster, toast } from "sonner";
import { AlertCircle, ArrowRight, Bot, X } from "lucide-react";
import { PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";
import type { Bounty } from "./types";
export type { Bounty };

// Strict-live: no frontend seed data. Empty until /api/bounties resolves.
const initialBounties: Bounty[] = [];

function getScreenFromPath(): "landing" | "auth" | "dashboard" {
  if (typeof window === "undefined") return "landing";
  const path = window.location.pathname.toLowerCase();
  if (
    path === "/auth" ||
    path === "/login" ||
    path === "/signup" ||
    path === "/register"
  ) {
    return "auth";
  }
  if (path === "/dashboard") {
    return "dashboard";
  }
  return "landing";
}

// Post-auth grace window: after sign-up/sign-in the client session atom lags
// navigation by >=10ms + a GET /get-session round-trip (better-auth fires its
// refetch signal inside a setTimeout). While grace is active the dashboard
// guard holds instead of bouncing back to /auth.
const AUTH_SESSION_GRACE_MS = 5000;

function navDebug(...args: unknown[]) {
  // Ungated by design: the auth race reproduces on deployed builds, where
  // import.meta.env.DEV is false. Strip before demo recording.
  // eslint-disable-next-line no-console
  console.debug("[Aegis-Nav]", ...args);
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "dark"; // Default to dark monochrome
  });

  const [currentScreen, setCurrentScreen] = useState<
    "landing" | "auth" | "dashboard"
  >(getScreenFromPath);
  const {
    data: authSession,
    isPending: isSessionPending,
    isRefetching: isSessionRefetching,
    refetch: refetchSession,
  } = authClient.useSession();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Post-auth grace: set right after sign-up/sign-in succeeds client-side.
  // The session atom lags by >=10ms + a GET /get-session round-trip, so the
  // dashboard guard must hold (not bounce) until the store catches up.
  const [awaitingSession, setAwaitingSession] = useState(false);
  const authGraceDeadlineRef = useRef(0);

  // The server session (httpOnly cookie) is the single source of truth for who is signed in.
  useEffect(() => {
    if (isSessionPending) return;
    if (!authSession?.user) {
      setCurrentUser(null);
      return;
    }
    const u = authSession.user as unknown as {
      id: string;
      name: string;
      email: string;
      role?: string;
      paypalEmail?: string | null;
    };
    setCurrentUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === "BUYER" ? "BUYER" : "DEVELOPER",
      paypalEmail: u.paypalEmail || undefined,
    });
  }, [authSession, isSessionPending]);

  const navigateTo = (
    screen: "landing" | "auth" | "dashboard",
    search = ""
  ) => {
    const pathMap: Record<"landing" | "auth" | "dashboard", string> = {
      landing: "/",
      auth: "/auth",
      dashboard: "/dashboard",
    };
    const targetPath = pathMap[screen] + search;
    navDebug("navigate", { from: window.location.pathname, to: targetPath });
    if (
      typeof window !== "undefined" &&
      window.location.pathname + window.location.search !== targetPath
    ) {
      window.history.pushState({ screen }, "", targetPath);
    }
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentScreen(getScreenFromPath());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Redirect to /auth only AFTER the session has resolved — never during render.
  // (Previously a render-time navigateTo() bounced hard-reloads at /dashboard
  // to /auth before the session cookie could revalidate.)
  // Post-auth, the session atom lags navigation by >=10ms + a GET round-trip,
  // so the guard holds while `awaitingSession` grace is active — and a
  // symmetric forward guard rescues the stranded case (session lands while the
  // screen is still /auth → push forward to /dashboard).
  useEffect(() => {
    if (isSessionPending) return;
    // Race-free: read better-auth's answer directly, not the lagging currentUser copy.
    const sessionUser = authSession?.user;
    if (sessionUser) {
      if (awaitingSession) {
        navDebug("session caught up after auth — releasing grace", {
          id: (sessionUser as { id?: string }).id,
        });
        setAwaitingSession(false);
      }
      if (currentScreen === "auth") {
        navDebug("forward: authenticated on /auth → /dashboard");
        navigateTo("dashboard");
      }
      return;
    }
    if (currentScreen !== "dashboard") return;
    if (awaitingSession) {
      if (Date.now() < authGraceDeadlineRef.current) {
        navDebug("guard held: awaiting post-auth session", {
          isRefetching: isSessionRefetching,
        });
        return;
      }
      navDebug("session grace expired with no session → honest bounce to /auth");
      setAwaitingSession(false);
    } else {
      navDebug("guard: /dashboard without session → /auth");
    }
    navigateTo("auth");
  }, [isSessionPending, isSessionRefetching, currentScreen, authSession, awaitingSession]);

  // Safety net: re-run the guard when the grace window expires, so a failed
  // session refetch still bounces honestly instead of stranding on /dashboard.
  // (If the session arrived, `awaitingSession` is already false and this is a no-op.)
  useEffect(() => {
    if (!awaitingSession) return;
    const remaining = Math.max(0, authGraceDeadlineRef.current - Date.now());
    navDebug("grace timer armed", { remainingMs: remaining });
    const t = setTimeout(() => {
      navDebug("grace timer fired — releasing grace");
      setAwaitingSession(false);
    }, remaining);
    return () => clearTimeout(t);
  }, [awaitingSession]);

  const [bounties, setBounties] = useState<Bounty[]>(initialBounties);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [isReviewerOpen, setIsReviewerOpen] = useState(false);
  const [isPostBountyOpen, setIsPostBountyOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Poll the hub (source of truth) so PROVISIONING → READY transitions,
  // progress lines, and settlements appear without a reload.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      fetch("/api/bounties")
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Local fallback");
        })
        .then((data: Bounty[]) => {
          if (!cancelled && Array.isArray(data)) {
            setBounties(data);
          }
        })
        .catch(() => {
          if (!cancelled) setBounties([]);
        });
    };
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const activeEscrowTotal = bounties
    .filter((b) => b.status !== "REFUNDED")
    .reduce((sum, b) => sum + b.escrowAmount, 0);

  const filterCounts = {
    ALL: bounties.length,
    IN_PROGRESS: bounties.filter((b) => b.status === "IN_PROGRESS").length,
    OPEN_FOR_CLAIM: bounties.filter((b) => b.status === "OPEN_FOR_CLAIM")
      .length,
    SETTLED: bounties.filter((b) => b.status === "SETTLED").length,
  };

  const filteredBounties = bounties.filter((b) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "OPEN_FOR_CLAIM") return b.status === "OPEN_FOR_CLAIM";
    if (activeFilter === "IN_PROGRESS") return b.status === "IN_PROGRESS";
    if (activeFilter === "SETTLED") return b.status === "SETTLED";
    return true;
  });

  const handleOpenReviewer = (bounty?: Bounty) => {
    const target =
      bounty ||
      bounties.find((b) => b.status === "READY_FOR_REVIEW") ||
      bounties[0];
    setSelectedBounty(target);
    setIsReviewerOpen(true);
  };

  interface ClaimAgent {
    id: string;
    name: string;
    framework: string;
  }

  // Agent picker for claiming: leases belong to registered agents, never to
  // bare human accounts. 0 agents → fleet; 1 → direct; >1 → picker modal.
  const [claimPicker, setClaimPicker] = useState<{
    bountyId: string;
    agents: ClaimAgent[];
  } | null>(null);
  const [claimPickerSelection, setClaimPickerSelection] = useState<string>("");
  const [claimingAgentId, setClaimingAgentId] = useState<string | null>(null);

  const doClaimBounty = async (bountyId: string, agent: ClaimAgent) => {
    setClaimingAgentId(agent.id);
    try {
      const res = await fetch(`/api/bounties/${bountyId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBounties((prev) =>
        prev.map((b) =>
          b.id === bountyId
            ? {
                ...b,
                status: "IN_PROGRESS",
                workerAgentId: data.agentId || agent.id,
                leaseExpiresAt: data.expiresAt,
              }
            : b
        )
      );
      toast.success(`30-minute lease claimed for ${agent.name}!`);
    } catch (err) {
      toast.error(`Failed to claim bounty: ${(err as Error).message}`);
    } finally {
      setClaimingAgentId(null);
      setClaimPicker(null);
    }
  };

  const handleClaimBounty = async (bountyId: string) => {
    try {
      const listRes = await fetch("/api/agents");
      if (listRes.status === 401) {
        toast.info("Sign in as a developer to claim bounties.");
        navigateTo("auth");
        return;
      }
      if (listRes.status === 403) {
        toast.error("Only developer accounts can claim bounties.");
        return;
      }
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      const list = (await listRes.json()) as Array<{
        id: string;
        name: string;
        framework: string;
        revoked?: boolean;
      }>;
      const usable = list.filter((a) => !a.revoked);
      if (usable.length === 0) {
        toast.info("Register an agent first — only registered agents can hold leases.");
        navigateTo("dashboard", "?tab=fleet");
        return;
      }
      if (usable.length === 1) {
        await doClaimBounty(bountyId, usable[0]);
        return;
      }
      setClaimPickerSelection(usable[0].id);
      setClaimPicker({ bountyId, agents: usable });
    } catch (err) {
      toast.error(`Failed to claim bounty: ${(err as Error).message}`);
    }
  };

  // Esc closes the agent picker.
  useEffect(() => {
    if (!claimPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClaimPicker(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [claimPicker]);

  const claimPickerModal = claimPicker && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Select agent to claim lease"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setClaimPicker(null)}
      />
      <div className="relative w-full max-w-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-medium tracking-tight">Select agent</h2>
          <button
            type="button"
            onClick={() => setClaimPicker(null)}
            aria-label="Close"
            className="w-7 h-7 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Leases belong to agents. Which of yours takes this bounty?
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {claimPicker.agents.map((a) => {
            const selected = claimPickerSelection === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setClaimPickerSelection(a.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-left transition-colors cursor-pointer ${
                  selected
                    ? "border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                <Bot className="w-4 h-4 shrink-0 text-zinc-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{a.name}</span>
                  <span className="block text-sm font-mono text-zinc-500 truncate">
                    {a.framework} · {a.id}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setClaimPicker(null)}
            className="px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-sm font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={claimingAgentId !== null}
            onClick={() => {
              const agent = claimPicker.agents.find((a) => a.id === claimPickerSelection);
              if (agent) void doClaimBounty(claimPicker.bountyId, agent);
            }}
            className="px-3.5 py-1.5 rounded-md bg-zinc-950 dark:bg-white text-white dark:text-black text-sm font-mono hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {claimingAgentId ? "Claiming…" : "Claim 30m lease"}
          </button>
        </div>
      </div>
    </div>
  );

  const handleBountySettled = (bountyId: string) => {
    setBounties((prev) =>
      prev.map((b) => (b.id === bountyId ? { ...b, status: "SETTLED" } : b))
    );
  };

  const handleBountyRefunded = (bountyId: string) => {
    setBounties((prev) =>
      prev.map((b) => (b.id === bountyId ? { ...b, status: "REFUNDED" } : b))
    );
  };

  const handleBountyCreated = (newBounty: Bounty) => {
    setBounties((prev) => [newBounty, ...prev]);
  };

  const handleAuthenticated = (user: UserSession) => {
    navDebug("auth success", { email: user.email, role: user.role }, "→ /dashboard, starting session grace");
    setCurrentUser(user);
    authGraceDeadlineRef.current = Date.now() + AUTH_SESSION_GRACE_MS;
    setAwaitingSession(true);
    // Kick the session refetch now instead of waiting on better-auth's
    // deferred (+10ms) atom signal.
    void refetchSession().catch((err) => {
      navDebug("post-auth session refetch failed", err);
    });
    navigateTo("dashboard");
  };

  const handleOpenPostBounty = () => {
    if (!currentUser) {
      toast.info("Sign in as a buyer to post a bounty.");
      navigateTo("auth");
      return;
    }
    if (currentUser.role !== "BUYER") {
      toast.error("Only buyer accounts can post bounties.");
      return;
    }
    setIsPostBountyOpen(true);
  };

  const handleSignOut = async () => {
    navDebug("sign out → /landing, clearing session grace");
    authGraceDeadlineRef.current = 0;
    setAwaitingSession(false);
    await authClient.signOut();
    setCurrentUser(null);
    navigateTo("landing");
  };

  const handleOpenRegisterAgent = () => {
    if (currentUser) {
      navigateTo("dashboard");
    } else {
      navigateTo("auth");
    }
  };

  if (currentScreen === "auth") {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors">
        <Toaster position="bottom-right" richColors theme={theme} />
        <AuthScreen
          initialRole="DEVELOPER"
          theme={theme}
          onToggleTheme={toggleTheme}
          onBackToHome={() => navigateTo("landing")}
          onAuthenticated={handleAuthenticated}
        />
      </div>
    );
  }

  if (currentScreen === "dashboard") {
    if (isSessionPending || !currentUser) {
      return (
        <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 flex flex-col items-center justify-center gap-3 transition-colors">
          <img
            src="/aegis-402-logo-black.svg"
            alt="Aegis-402"
            className="w-8 h-8 dark:hidden animate-pulse"
          />
          <img
            src="/aegis-402-logo-white.svg"
            alt="Aegis-402"
            className="w-8 h-8 hidden dark:block animate-pulse"
          />
          <p className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
            Restoring session…
          </p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors">
        <Toaster position="bottom-right" richColors theme={theme} />
        <DashboardScreen
          user={currentUser}
          theme={theme}
          onToggleTheme={toggleTheme}
          onNavigateToMarketplace={() => navigateTo("landing")}
          onSignOut={handleSignOut}
          bounties={bounties}
          onOpenReviewer={handleOpenReviewer}
          onClaimBounty={handleClaimBounty}
          onBountySettled={handleBountySettled}
          onBountyRefunded={handleBountyRefunded}
          onOpenPostBounty={handleOpenPostBounty}
        />
        <ZeroLeakCanvasModal
          bounty={selectedBounty}
          isOpen={isReviewerOpen}
          onClose={() => setIsReviewerOpen(false)}
          onSettled={handleBountySettled}
          onRefunded={handleBountyRefunded}
        />
        <PostBountyModal
          isOpen={isPostBountyOpen}
          onClose={() => setIsPostBountyOpen(false)}
          onBountyCreated={handleBountyCreated}
        />
        {claimPickerModal}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors">
      <Toaster position="bottom-right" richColors theme={theme} />

      {/* Floating Capsule Island Navbar */}
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenPostBounty={handleOpenPostBounty}
        user={currentUser}
        onOpenAuth={() => navigateTo("auth")}
        onOpenDashboard={() => navigateTo("dashboard")}
        onNavigateHome={() => navigateTo("landing")}
      />

      {/* Main Content Layout */}
      <main className="flex-1">
        {/* Section 1: Hero Section (Headline + Centerpiece Zero-Leak Canvas Window) */}
        <HeroSection
          theme={theme}
          onOpenPostBounty={handleOpenPostBounty}
          onOpenRegisterAgent={handleOpenRegisterAgent}
        />

        {/* Section 2: Trust & Metrics (Clean 1-line counters) */}
        <TrustBar />

        {/* Section 3: Architecture (Zero-Leak Referee, PayPal Escrow, Autonomous MCP, Atomic Settlement) */}
        <FeatureSplitSection />

        {/* Section 4: Protocol & Code Explorer (Mintlify-style Split-Screen Code & Attestation Manifest) */}
        <MidnightMcpSection />

        {/* Section 5: Comparative Analysis Matrix (Traditional vs Crypto vs Aegis-402 PayPal Escrow) */}
        <WhyAegisSection onOpenPostBounty={handleOpenPostBounty} />

        {/* Section 6: Live Bounty Marketplace */}
        <section
          id="marketplace"
          className="py-20 max-w-6xl mx-auto px-4 sm:px-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-2">
                <span>Escrow Marketplace</span>
                <span>•</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  ${activeEscrowTotal.toFixed(2)} USD Locked
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-normal tracking-tight text-zinc-950 dark:text-white">
                Active Bounties with{" "}
                <span className="font-bold">Locked PayPal Escrow</span>
              </h2>
            </div>

            {/* Filter Tabs with Count Pills */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-mono">
              {[
                { id: "ALL", label: "All" },
                { id: "IN_PROGRESS", label: "In Progress" },
                { id: "OPEN_FOR_CLAIM", label: "Open Claims" },
                { id: "SETTLED", label: "Settled" },
              ].map((f) => {
                const count =
                  filterCounts[f.id as keyof typeof filterCounts] ?? 0;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                      activeFilter === f.id
                        ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium shadow-xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="text-[10px] text-zinc-400">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bounty Grid (max 3) or Empty State */}
          {filteredBounties.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBounties.slice(0, 3).map((b) => (
                  <BountyCard
                    key={b.id}
                    bounty={b}
                    onClaim={handleClaimBounty}
                  />
                ))}
              </div>
              {filteredBounties.length > 3 && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() =>
                      currentUser
                        ? navigateTo("dashboard", "?tab=marketplace")
                        : navigateTo("auth")
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-sm font-mono text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <span>See more bounties</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
              <AlertCircle className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                No bounties in this category
              </div>
            </div>
          )}
        </section>

        {/* Section 7: Quickstart Pre-Footer CTA */}
        <PreFooterCta
          onOpenPostBounty={handleOpenPostBounty}
          onOpenRegisterAgent={handleOpenRegisterAgent}
        />
      </main>

      {/* Section 8: Minimalist Footer */}
      <Footer />

      {/* Post Bounty (PayPal Escrow Authorization) Modal */}
      <PostBountyModal
        isOpen={isPostBountyOpen}
        onClose={() => setIsPostBountyOpen(false)}
        onBountyCreated={handleBountyCreated}
      />
      {claimPickerModal}
    </div>
  );
}

export default function WrappedApp() {
  return (
    <PayPalProvider
      clientId="BAA3Al1Iue_hLbdvuCxl4bVsPZJRDFRQdWJ9-XbENzDzzag2DzY8gtbeDkDpUAO-s5OHB3tN3fUqOlYE8Y"
      environment="sandbox"
      components={["paypal-payments"]}
      pageType="checkout"
    >
      <App />
    </PayPalProvider>
  );
}
