import { useState, useEffect } from "react";
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
import { DashboardScreen } from "./components/DashboardScreen";
import { Toaster, toast } from "sonner";
import { AlertCircle } from "lucide-react";
import type { Bounty } from "./types";
export type { Bounty };

const initialBounties: Bounty[] = [
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
  },
];

function getScreenFromPath(): "landing" | "auth" | "dashboard" {
  if (typeof window === "undefined") return "landing";
  const path = window.location.pathname.toLowerCase();
  if (path === "/auth" || path === "/login" || path === "/signup" || path === "/register") {
    return "auth";
  }
  if (path === "/dashboard") {
    return "dashboard";
  }
  return "landing";
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark"; // Default to dark monochrome
  });

  const [currentScreen, setCurrentScreen] = useState<"landing" | "auth" | "dashboard">(getScreenFromPath);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aegis_user_session");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const navigateTo = (screen: "landing" | "auth" | "dashboard") => {
    const pathMap: Record<"landing" | "auth" | "dashboard", string> = {
      landing: "/",
      auth: "/auth",
      dashboard: "/dashboard",
    };
    const targetPath = pathMap[screen];
    if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
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

  useEffect(() => {
    fetch("/api/bounties")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Local fallback");
      })
      .then((data: Bounty[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setBounties(data);
        }
      })
      .catch(() => {
        // keep initial mock bounties
      });
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const activeEscrowTotal = bounties
    .filter((b) => b.status !== "REFUNDED")
    .reduce((sum, b) => sum + b.escrowAmount, 0);

  const filterCounts = {
    ALL: bounties.length,
    READY_FOR_REVIEW: bounties.filter((b) => b.status === "READY_FOR_REVIEW").length,
    IN_PROGRESS: bounties.filter((b) => b.status === "IN_PROGRESS").length,
    OPEN_FOR_CLAIM: bounties.filter((b) => b.status === "OPEN_FOR_CLAIM").length,
    SETTLED: bounties.filter((b) => b.status === "SETTLED").length,
  };

  const filteredBounties = bounties.filter((b) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "READY_FOR_REVIEW") return b.status === "READY_FOR_REVIEW";
    if (activeFilter === "OPEN_FOR_CLAIM") return b.status === "OPEN_FOR_CLAIM";
    if (activeFilter === "IN_PROGRESS") return b.status === "IN_PROGRESS";
    if (activeFilter === "SETTLED") return b.status === "SETTLED";
    return true;
  });

  const handleOpenReviewer = (bounty?: Bounty) => {
    const target = bounty || bounties.find((b) => b.status === "READY_FOR_REVIEW") || bounties[0];
    setSelectedBounty(target);
    setIsReviewerOpen(true);
  };

  const handleClaimBounty = async (bountyId: string) => {
    try {
      const res = await fetch(`/api/bounties/${bountyId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent-interactive-tester" }),
      });
      const data = await res.json();
      setBounties((prev) =>
        prev.map((b) =>
          b.id === bountyId
            ? { ...b, status: "IN_PROGRESS", workerAgentId: "agent-interactive-tester", leaseExpiresAt: data.expiresAt }
            : b
        )
      );
      toast.success("15-minute lease claimed on bounty!");
    } catch {
      toast.error("Failed to claim bounty.");
    }
  };

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
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("aegis_user_session", JSON.stringify(user));
    }
    navigateTo("dashboard");
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("aegis_user_session");
    }
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
    if (!currentUser) {
      navigateTo("auth");
      return null;
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
          onOpenPostBounty={() => setIsPostBountyOpen(true)}
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
        onOpenPostBounty={() => setIsPostBountyOpen(true)}
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
          onOpenReviewer={() => handleOpenReviewer()}
          onOpenPostBounty={() => setIsPostBountyOpen(true)}
          onOpenRegisterAgent={handleOpenRegisterAgent}
        />

        {/* Section 2: Trust & Metrics (Clean 1-line counters) */}
        <TrustBar />

        {/* Section 3: Architecture & 4 Pillars (Zero-Leak CDP, PayPal Escrow, Autonomous MCP, AES-256) */}
        <FeatureSplitSection onOpenReviewer={() => handleOpenReviewer()} />

        {/* Section 4: Protocol & Code Explorer (Mintlify-style Split-Screen Code & Attestation Manifest) */}
        <MidnightMcpSection />

        {/* Section 5: Comparative Analysis Matrix (Traditional vs Crypto vs Aegis-402 PayPal Escrow) */}
        <WhyAegisSection onOpenPostBounty={() => setIsPostBountyOpen(true)} />

        {/* Section 6: Live Bounty Marketplace */}
        <section id="marketplace" className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-2">
                <span>Escrow Marketplace</span>
                <span>•</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  ${activeEscrowTotal.toFixed(2)} USD Locked
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-normal tracking-tight text-zinc-950 dark:text-white">
                Active Bounties with <span className="font-bold">Locked PayPal Escrow</span>
              </h2>
            </div>

            {/* Filter Tabs with Count Pills */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
              {[
                { id: "ALL", label: "All" },
                { id: "READY_FOR_REVIEW", label: "Ready to Review" },
                { id: "IN_PROGRESS", label: "In Progress" },
                { id: "OPEN_FOR_CLAIM", label: "Open Claims" },
                { id: "SETTLED", label: "Settled" },
              ].map((f) => {
                const count = filterCounts[f.id as keyof typeof filterCounts] ?? 0;
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

          {/* Bounty Grid or Empty State */}
          {filteredBounties.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBounties.map((b) => (
                <BountyCard
                  key={b.id}
                  bounty={b}
                  onInspect={(target) => {
                    setSelectedBounty(target);
                    setIsReviewerOpen(true);
                  }}
                  onClaim={handleClaimBounty}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
              <AlertCircle className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
              <div className="text-sm text-zinc-600 dark:text-zinc-400">No bounties in this category</div>
            </div>
          )}
        </section>

        {/* Section 7: Quickstart Pre-Footer CTA */}
        <PreFooterCta
          onOpenPostBounty={() => setIsPostBountyOpen(true)}
          onOpenReviewer={() => handleOpenReviewer()}
          onOpenRegisterAgent={handleOpenRegisterAgent}
        />
      </main>

      {/* Section 8: Minimalist Footer */}
      <Footer />

      {/* Interactive Zero-Leak Canvas Reviewer Modal */}
      <ZeroLeakCanvasModal
        bounty={selectedBounty}
        isOpen={isReviewerOpen}
        onClose={() => setIsReviewerOpen(false)}
        onSettled={handleBountySettled}
        onRefunded={handleBountyRefunded}
      />

      {/* Post Bounty (PayPal Escrow Authorization) Modal */}
      <PostBountyModal
        isOpen={isPostBountyOpen}
        onClose={() => setIsPostBountyOpen(false)}
        onBountyCreated={handleBountyCreated}
      />
    </div>
  );
}

export default App;
