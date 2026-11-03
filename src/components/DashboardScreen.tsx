import { useState, useEffect } from "react";
import {
  Bot,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  FileCode,
  Clock,
  Lock,
  Settings,
  User,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { UserSession } from "./AuthScreen";
import type { Bounty } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import { ChartAreaInteractive } from "./chart-area-interactive";
import { MarketplaceView } from "./MarketplaceView";
import { ReviewQueue } from "./ReviewQueue";
import { AuditScreen } from "./AuditScreen";
import { LeaseTimeline } from "./LeaseTimeline";

interface DashboardScreenProps {
  user: UserSession;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNavigateToMarketplace?: () => void;
  onSignOut: () => void;
  bounties: Bounty[];
  onOpenReviewer: (bounty: Bounty) => void;
  onClaimBounty?: (bountyId: string) => void;
  onBountySettled?: (bountyId: string) => void;
  onBountyRefunded?: (bountyId: string) => void;
  onOpenPostBounty?: () => void;
}

interface AgentItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  claimedBountiesCount: number;
  framework: "Claude Code" | "Cursor" | "Windsurf" | "OpenCode" | "Custom stdio";
}

type ConfigClient = "claude" | "cursor" | "windsurf" | "opencode";

const CONFIG_CLIENT_LABEL: Record<ConfigClient, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  windsurf: "Windsurf",
  opencode: "OpenCode",
};

/** IDE/MCP client config snippet for a given client. Local-only install (not
 *  published): `npm install -g ./aegis-402-mcp`, then the `aegis-mcp` binary.
 *  No key in the config — the agent saves it to the key file (bootstrap prompt
 *  step 0b) and the server loads it automatically. */
function configSnippetFor(client: ConfigClient, _key: string): string {
  if (client === "cursor") {
    return JSON.stringify(
      {
        mcpServers: {
          aegis402: {
            type: "command",
            command: "aegis-mcp",
            env: { AEGIS_HUB_URL: window.location.origin },
          },
        },
      },
      null,
      2
    );
  }
  if (client === "opencode") {
    return JSON.stringify(
      {
        mcp: {
          aegis: {
            type: "local",
            command: ["aegis-mcp"],
            env: { AEGIS_HUB_URL: window.location.origin },
          },
        },
      },
      null,
      2
    );
  }
  return JSON.stringify(
    {
      mcpServers: {
        "aegis-402": {
          command: "aegis-mcp",
          env: { AEGIS_HUB_URL: window.location.origin },
        },
      },
    },
    null,
    2
  );
}

/** Copy-paste bootstrap prompt so any model can self-configure as a worker.
 *  MCP-first: the tools + SKILL.md are the source of truth, never endpoint URLs. */
function bootstrapPromptFor(agentName: string, key: string, hubUrl: string): string {
  return [
    `You are ${agentName}, an autonomous worker on Aegis-402 (zero-trust software escrow).`,
    ``,
    `0. CONNECT (MCP only — never guess endpoint URLs). Local install, not published:`,
    `   Install once (repo checkout): npm install -g ./aegis-402-mcp, then add this MCP server to your client and verify with the aegis_list_bounties tool:`,
    `   {"mcpServers":{"aegis-402":{"command":"aegis-mcp","env":{"AEGIS_HUB_URL":"${hubUrl}"}}}}`,
    `   All workflow knowledge lives in the MCP tools + the worker skill — read it first with the aegis_get_skill tool, then follow it.`,
    ``,
    `0b. SAVE THE KEY (once, before anything else — shown only once, never in MCP config):`,
    `   mkdir -p ~/.aegis && printf '%s' '${key}' > ~/.aegis/key && chmod 600 ~/.aegis/key && echo '${agentName}' > ~/.aegis/agent-name`,
    `   The MCP server loads this file automatically on every call (no restart, no key in MCP config). Never commit it, never put it in a deliverable tarball.`,
    ``,
    `1. WORKSPACE: mkdir -p aegis-bounties/<BOUNTY_ID> && cd aegis-bounties/<BOUNTY_ID>.`,
    `   Keep AGENTS.md (bounty, escrow, acceptance criteria, checkpoint log) and MEMORY.md (decisions).`,
    `   .aegis-session.json is MCP-managed — never hand-edit it.`,
    ``,
    `2. FLOW (MCP tools; REST only if MCP is unreachable — hub ${hubUrl}, header x-agent-key):`,
    `   aegis_list_bounties → pick OPEN_FOR_CLAIM → aegis_check_escrow (need verified:true LIVE) →`,
    `   aegis_claim_bounty({bountyId, agentId:"${agentName}"}) → WORK, aegis_push_checkpoint({stage, summary}) every 15-20 min →`,
    `   aegis_validate_artifact({archivePath}) until valid → aegis_upload_artifact({bountyId, archivePath}) → aegis_submit_deliverable().`,
    `   Stages: SCAFFOLDING → CORE_LOGIC → TESTING → FINAL_POLISH. Watch the lease countdown in every response; aegis_lease_status anytime.`,
    ``,
    `3. RULES: a failed tool call (isError) means nothing happened — never invent lease tokens, never proceed past a failure. Seal per SKILL.md (aegis.json at tarball root). The arbiter provisions from the sealed vault; the buyer reviews via zero-leak canvas; PayPal CAPTURE pays, VOID refunds.`,
  ].join("\n");
}

const agentNameSchema = z
  .string()
  .trim()
  .min(2, "Agent name must be at least 2 characters")
  .max(32, "Agent name must be at most 32 characters")
  .regex(
    /^[a-zA-Z0-9_\-.]+$/,
    "Agent name can only contain letters, numbers, hyphens, underscores, and dots"
  );

export function DashboardScreen({
  user,
  theme,
  onToggleTheme,
  onSignOut,
  bounties,
  onOpenReviewer,
  onClaimBounty,
  onBountySettled,
  onBountyRefunded,
  onOpenPostBounty,
}: DashboardScreenProps) {
  const isBuyer = user?.role === "BUYER";
  // Default tab based on role (Buyers to Approvals, Developers to Marketplace)
  const [activeTab, setActiveTab] = useState<string>(() =>
    isBuyer ? "approvals" : "marketplace"
  );

  // Registered agents — server-issued per-agent keys (GET /api/agents).
  // Plaintext keys are returned ONCE at mint time and kept only in memory.
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [freshKeys, setFreshKeys] = useState<Record<string, string>>({});
  const [agentsLoading, setAgentsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Agents are a developer-only resource — buyers must never call this endpoint.
    if (user.role !== "DEVELOPER") {
      setAgentsLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          id: string;
          name: string;
          framework: AgentItem["framework"];
          keyPrefix: string;
          createdAt: number;
          revoked: boolean;
        }>;
        if (cancelled) return;
        setAgents(
          data
            .filter((a) => !a.revoked)
            .map((a) => ({
              id: a.id,
              name: a.name,
              keyPrefix: a.keyPrefix,
              createdAt: new Date(a.createdAt).toLocaleString(),
              claimedBountiesCount: 0,
              framework: a.framework,
            }))
        );
      } catch {
        // offline — show empty state, user can register
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  // Live PayPal lock verification per bounty (escrow tab only, on demand).
  const [escrowLive, setEscrowLive] = useState<
    Record<string, { verified: boolean; mode: string; status?: string }>
  >({});
  useEffect(() => {
    if (activeTab !== "escrow") return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        bounties.map(async (b) => {
          try {
            const res = await fetch(`/api/bounties/${b.id}/escrow-status`);
            if (!res.ok) return null;
            const data = (await res.json()) as {
              verified: boolean;
              mode: string;
              paypal?: { status?: string };
            };
            return [b.id, { verified: data.verified, mode: data.mode, status: data.paypal?.status }] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, { verified: boolean; mode: string; status?: string }> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setEscrowLive(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, bounties]);

  const displayKeyFor = (agent: AgentItem) =>
    freshKeys[agent.id] ?? `${agent.keyPrefix}••••••••`;

  const [isRegisteringAgent, setIsRegisteringAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentFramework, setNewAgentFramework] =
    useState<AgentItem["framework"]>("Claude Code");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);
  const [copiedConfigId, setCopiedConfigId] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>(
    {}
  );
  const [selectedConfigClient, setSelectedConfigClient] =
    useState<ConfigClient>("claude");
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetryPayout = async (bountyId: string) => {
    setRetryingId(bountyId);
    try {
      const res = await fetch(`/api/bounties/${bountyId}/retry-payout`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; developerPayout?: string; payoutTo?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Payout re-sent: ${data.developerPayout || ""} → ${data.payoutTo || "developer"}. Refresh to see status.`);
    } catch (err) {
      toast.error(`Payout retry failed: ${(err as Error).message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDownloadArtifact = async (bountyId: string) => {
    setDownloadingId(bountyId);
    try {
      // Hub issues an expiring signed URL; the BROWSER pulls bytes straight
      // from the arbiter. Nothing routes through the worker or D1.
      const res = await fetch(`/api/bounties/${bountyId}/artifact/download`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
      toast.success("Download started — verify sha256 after extracting.");
    } catch {
      toast.error("Artifact download failed.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreateNewAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = agentNameSchema.safeParse(newAgentName);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message || "Invalid agent nickname");
      return;
    }

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAgentName.trim(), framework: newAgentFramework }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const minted = (await res.json()) as {
        id: string;
        name: string;
        framework: AgentItem["framework"];
        apiKey: string;
        keyPrefix: string;
        createdAt: number;
      };

      const newAgent: AgentItem = {
        id: minted.id,
        name: minted.name,
        keyPrefix: minted.keyPrefix,
        createdAt: "Just now",
        claimedBountiesCount: 0,
        framework: minted.framework,
      };

      setAgents((prev) => [newAgent, ...prev]);
      // Plaintext shown ONCE — never persisted, never refetchable
      setFreshKeys((prev) => ({ ...prev, [minted.id]: minted.apiKey }));
      setRevealedKeyIds((prev) => ({ ...prev, [minted.id]: true }));
      setNewAgentName("");
      setIsRegisteringAgent(false);
      toast.success(
        `Agent "${newAgent.name}" registered. Copy the key now — it won't be shown again.`
      );
    } catch (err) {
      toast.error(`Failed to register agent: ${(err as Error).message}`);
    }
  };

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      toast.error("Failed to revoke agent key on server.");
      return;
    }
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    setFreshKeys((prev) => {
      const { [agentId]: _dropped, ...rest } = prev;
      return rest;
    });
    toast.info(`Revoked agent "${agentName}".`);
  };

  const handleCopyKey = (agentId: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(agentId);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCopyCmd = (agentId: string, key: string) => {
    const cmd = `npm install -g ./aegis-402-mcp && AEGIS_HUB_URL=${window.location.origin} aegis-mcp`;
    void key; void agentId;
    navigator.clipboard.writeText(cmd);
    setCopiedCmdId(agentId);
    toast.success("Terminal launch command copied to clipboard");
    setTimeout(() => setCopiedCmdId(null), 2000);
  };

  const handleCopyConfigSnippet = (key: string) => {
    const snippet = configSnippetFor(selectedConfigClient, key);
    navigator.clipboard.writeText(snippet);
    setCopiedConfigId(key);
    toast.success(
      `${CONFIG_CLIENT_LABEL[selectedConfigClient]} MCP configuration copied`
    );
    setTimeout(() => setCopiedConfigId(null), 2000);
  };

  const handleCopyBootstrapPrompt = (agentId: string, agentName: string, key: string) => {
    navigator.clipboard.writeText(bootstrapPromptFor(agentName, key, window.location.origin));
    setCopiedPromptId(agentId);
    toast.success("Worker bootstrap prompt copied — paste it into any model");
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const toggleRevealKey = (agentId: string) => {
    setRevealedKeyIds((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  const myDeliverables = bounties.filter(
    (b) =>
      b.workerAgentId ||
      b.status === "IN_PROGRESS" ||
      b.status === "PROVISIONING" ||
      b.status === "READY_FOR_REVIEW" ||
      b.status === "SETTLED"
  );

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 50)",
            "--sidebar-width-icon": "2.5rem",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          user={user}
          bounties={bounties}
          agentCount={agents.length}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onSignOut={onSignOut}
          onToggleTheme={onToggleTheme}
          theme={theme}
        />

        <SidebarInset>
          {/* SiteHeader with Breadcrumb and Inset Alignment */}
          <SiteHeader
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onOpenPostBounty={onOpenPostBounty}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />

          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* VIEW: Marketplace */}
                {(activeTab === "marketplace" || activeTab === "bounties") && (
                  <MarketplaceView
                    bounties={bounties}
                    userRole={user.role}
                    onClaimBounty={onClaimBounty || (() => {})}
                    onDownloadBounty={handleDownloadArtifact}
                    onOpenReviewer={onOpenReviewer}
                  />
                )}

                {/* VIEW: Deliverable Approvals (Buyer Review & Sandbox) */}
                {(activeTab === "approvals" || activeTab === "review-queue") && (
                  <ReviewQueue
                    bounties={bounties}
                    onSettled={onBountySettled}
                    onRefunded={onBountyRefunded}
                  />
                )}

                {/* VIEW: Code Downloads (buyer: settled vaults) */}
                {activeTab === "downloads" && (
                  <div className="px-4 lg:px-6 space-y-5">
                    <div className="pb-3 border-b border-border">
                      <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
                        <Download className="size-4" />
                        <span>Code Downloads</span>
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Released vaults from settled bounties. Links pull straight
                        from the arbiter and expire 7 days after settlement.
                      </p>
                    </div>

                    {bounties.filter((b) => b.status === "SETTLED").length === 0 ? (
                      <div className="p-8 text-center rounded-md border border-dashed border-border bg-muted/20">
                        <Download className="size-8 text-foreground/40 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground">
                          No settled code yet
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Approve a deliverable and its vault lands here for download.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {bounties
                          .filter((b) => b.status === "SETTLED")
                          .map((b) => (
                            <div
                              key={b.id}
                              className="rounded-lg border border-border bg-card p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                    {b.category}
                                  </span>
                                  <span className="text-muted-foreground/60">•</span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {b.id}
                                  </span>
                                </div>
                                <h3 className="text-base font-medium text-foreground tracking-tight">
                                  {b.title}
                                </h3>
                                <p className="font-mono text-sm text-muted-foreground">
                                  ${b.escrowAmount.toFixed(2)} USD
                                  {b.settledAt
                                    ? ` · settled ${new Date(b.settledAt).toLocaleString()}`
                                    : ""}
                                  {b.invoiceStatus ? ` · receipt: ${b.invoiceStatus}` : ""}
                                </p>
                              </div>
                              {b.artifactSha256 ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleDownloadArtifact(b.id)}
                                  disabled={downloadingId === b.id}
                                  className="text-sm shrink-0"
                                >
                                  <Download className="size-3.5" />
                                  <span>
                                    {downloadingId === b.id ? "issuing link…" : "Download .tar.gz"}
                                  </span>
                                </Button>
                              ) : (
                                <span className="text-sm text-muted-foreground shrink-0">
                                  No code vault (preview-only deliverable)
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW: My Deliverables & Submissions (Developer) */}
                {activeTab === "deliverables" && (
                  <div className="px-4 lg:px-6 space-y-5">
                    <div className="pb-3 border-b border-border">
                      <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
                        <FileCode className="size-4" />
                        <span>My Deliverables</span>
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Track your agent's active claims, test passing metrics, and pending PayPal payouts.
                      </p>
                    </div>

                    {myDeliverables.length === 0 ? (
                      <div className="p-8 text-center rounded-md border border-dashed border-border bg-muted/20">
                        <FileCode className="size-8 text-foreground/40 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground">
                          No active deliverables
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Claim an open bounty from the Marketplace or run an agent via MCP to get started.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("marketplace")}
                          className="mt-4 text-sm"
                        >
                          Browse Marketplace
                        </Button>
                      </div>
                    ) : (
                      <div className="relative pl-9 sm:pl-11 space-y-6 before:absolute before:left-[13.5px] before:top-6 before:bottom-6 before:w-px before:bg-border">
                        {myDeliverables.map((bounty, idx) => {
                          const itemIndex = String(idx + 1).padStart(2, "0");
                          const stages = [
                            { id: "SCAFFOLDING", name: "1. Scaffolding" },
                            { id: "CORE_LOGIC", name: "2. Core Logic" },
                            { id: "TESTING", name: "3. Testing" },
                            { id: "FINAL_POLISH", name: "4. Final Polish" },
                          ];
                          const currentIdx = stages.findIndex(
                            (s) => s.id === (bounty.currentStage || "SCAFFOLDING")
                          );
                          const isDoneOverall =
                            bounty.status === "READY_FOR_REVIEW" ||
                            bounty.status === "SETTLED";
                          const isSettled = bounty.status === "SETTLED";
                          const isReady = bounty.status === "READY_FOR_REVIEW";

                          return (
                            <div key={bounty.id} className="relative group">
                              {/* Left Timeline Spine Node */}
                              <div
                                className={`absolute -left-9 sm:-left-11 top-5 size-7 rounded-full border flex items-center justify-center font-mono text-[10px] font-semibold z-10 transition-all shadow-xs ${
                                  isSettled
                                    ? "bg-foreground text-background border-foreground"
                                    : isReady
                                    ? "bg-card text-emerald-500 border-emerald-500/60"
                                    : "bg-card text-foreground border-border group-hover:border-foreground/50"
                                }`}
                              >
                                {itemIndex}
                              </div>

                              <div className="rounded-lg border border-border bg-card p-5 space-y-5 transition-all shadow-sm hover:border-zinc-400 dark:hover:border-zinc-700">
                                {/* Header row: title, category, id, escrow amount, status */}
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                        {bounty.category}
                                      </span>
                                      <span className="text-muted-foreground/60">•</span>
                                      <span className="font-mono text-[11px] text-muted-foreground">
                                        {bounty.id}
                                      </span>
                                    </div>
                                    <h3 className="text-base font-medium text-foreground tracking-tight">
                                      {bounty.title}
                                    </h3>
                                    {bounty.description && (
                                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl pt-0.5">
                                        {bounty.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="sm:text-right shrink-0 space-y-1.5">
                                    <div className="flex sm:justify-end items-baseline gap-1">
                                      <span className="font-mono text-lg font-semibold text-foreground">
                                        ${bounty.escrowAmount.toFixed(2)}
                                      </span>
                                      <span className="font-mono text-sm text-muted-foreground">
                                        USD
                                      </span>
                                    </div>
                                    <Badge
                                      variant={
                                        bounty.status === "SETTLED"
                                          ? "default"
                                          : bounty.status === "READY_FOR_REVIEW"
                                          ? "emerald"
                                          : "amber"
                                      }
                                      className="text-[10px] tracking-wide"
                                    >
                                      {bounty.status === "READY_FOR_REVIEW"
                                        ? "Pending Buyer Approval"
                                        : bounty.status === "PROVISIONING"
                                        ? "Provisioning Sandbox"
                                        : bounty.status === "IN_PROGRESS"
                                        ? "Active 30m Lease"
                                        : "Settled & Paid"}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Milestone Progress Track (Linear-style segmented bar) */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                      Milestone Lifecycle
                                    </span>
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                      {isDoneOverall
                                        ? "4 of 4 Stages Complete"
                                        : `Stage ${currentIdx + 1} of 4: ${stages[currentIdx]?.name || "In Progress"}`}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-4 gap-2 pt-1">
                                    {stages.map((step, idx) => {
                                      const stepDone = isDoneOverall || idx < currentIdx;
                                      const stepCurrent =
                                        idx === currentIdx && bounty.status === "IN_PROGRESS";

                                      return (
                                        <div key={step.id} className="space-y-1.5">
                                          <div
                                            className={`h-1.5 rounded-full transition-all ${
                                              stepDone
                                                ? "bg-foreground"
                                                : stepCurrent
                                                ? "bg-foreground/60 animate-pulse"
                                                : "bg-muted"
                                            }`}
                                          />
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span
                                              className={`font-medium ${
                                                stepDone || stepCurrent
                                                  ? "text-foreground"
                                                  : "text-muted-foreground/60"
                                              }`}
                                            >
                                              {step.name}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Inline Metadata Row (No nested boxes) */}
                                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border text-sm">
                                  <div className="flex flex-wrap items-center gap-6">
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                                        Automated Tests
                                      </span>
                                      <span className="font-mono text-sm font-medium text-foreground">
                                        {bounty.testsPassed}/{bounty.testsTotal} Passed (
                                        {Math.round(
                                          (bounty.testsPassed / (bounty.testsTotal || 1)) * 100
                                        )}
                                        %)
                                      </span>
                                    </div>

                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                                        Assigned Agent
                                      </span>
                                      <span className="font-mono text-sm text-foreground">
                                        {bounty.workerAgentId || "agent-mcp-worker"}
                                      </span>
                                    </div>

                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                                        Escrow Status
                                      </span>
                                      <span className="text-sm text-foreground">
                                        {bounty.status === "SETTLED"
                                          ? bounty.payoutBatchId && !((bounty.payoutStatus || "").toUpperCase().startsWith("FAILED") || (bounty.payoutStatus || "").toUpperCase().startsWith("SKIPPED"))
                                            ? `Paid ${bounty.developerPayout != null ? `$${bounty.developerPayout.toFixed(2)}` : ""} to PayPal`
                                            : "Settled — payout pending"
                                          : "Locked in Escrow Hold"}
                                      </span>
                                    </div>
                                    {bounty.status === "SETTLED" && (!bounty.payoutBatchId || (bounty.payoutStatus || "").toUpperCase().startsWith("FAILED") || (bounty.payoutStatus || "").toUpperCase().startsWith("SKIPPED")) && (
                                      <div>
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                                          Payout
                                        </span>
                                        <button
                                          onClick={() => handleRetryPayout(bounty.id)}
                                          disabled={retryingId === bounty.id}
                                          className="text-sm text-[#0070ba] underline underline-offset-2 hover:no-underline cursor-pointer disabled:opacity-50"
                                          title={bounty.payoutStatus || "payout not sent"}
                                        >
                                          {retryingId === bounty.id ? "retrying…" : "Retry my payout"}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Context Notice */}
                                  {bounty.status === "READY_FOR_REVIEW" && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Clock className="size-3.5 text-foreground shrink-0" />
                                      <span>
                                        Awaiting buyer approval for{" "}
                                        <strong className="font-mono text-foreground">
                                          ${bounty.escrowAmount.toFixed(2)} USD
                                        </strong>{" "}
                                        payout
                                      </span>
                                    </div>
                                  )}

                                  {bounty.status === "IN_PROGRESS" && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      <span>
                                        Push checkpoints via MCP to extend lease
                                      </span>
                                    </div>
                                  )}

                                  {bounty.status === "PROVISIONING" && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      <span className="font-mono">
                                        {bounty.latestProgress || "Queued for sandbox provisioning"}
                                      </span>
                                    </div>
                                  )}

                                  {bounty.provisionError && (
                                    <div className="flex items-center gap-2 text-sm text-rose-500">
                                      <span>Sandbox failed: {bounty.provisionError} — fix, re-seal, re-deliver.</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW: Agents & MCP Keys */}
                {(activeTab === "agents" || activeTab === "fleet") && (
                  <div className="px-4 lg:px-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div>
                        <h2 className="text-base font-medium text-foreground font-mono flex items-center gap-2">
                          <Bot className="size-4" />
                          <span>Agents & API Keys</span>
                        </h2>
                        <p className="text-sm text-muted-foreground font-mono">
                          Configure MCP credentials for Claude Code, Cursor, and
                          Windsurf to connect and claim bounties.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsRegisteringAgent(true)}
                      >
                        <Plus className="size-3.5" />
                        <span>Register Agent</span>
                      </Button>
                    </div>

                    {isRegisteringAgent && (
                      <form
                        onSubmit={handleCreateNewAgent}
                        className="p-5 rounded-md border border-border bg-muted/30 space-y-4 font-mono text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground flex items-center gap-2">
                            <Bot className="size-4" />
                            <span>Register Agent</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsRegisteringAgent(false)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] uppercase text-muted-foreground mb-1">
                              Agent Name
                            </label>
                            <Input
                              type="text"
                              value={newAgentName}
                              onChange={(e) => setNewAgentName(e.target.value)}
                              placeholder="e.g. claude-code-primary or cursor-fullstack"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-muted-foreground mb-1">
                              Client
                            </label>
                            <Select
                              value={newAgentFramework}
                              onValueChange={(v) =>
                                setNewAgentFramework(
                                  v as AgentItem["framework"]
                                )
                              }
                            >
                              <SelectTrigger className="w-full h-8 font-mono text-sm">
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Claude Code">Claude Code</SelectItem>
                                <SelectItem value="Cursor">Cursor</SelectItem>
                                <SelectItem value="Windsurf">Windsurf</SelectItem>
                                <SelectItem value="OpenCode">OpenCode</SelectItem>
                                <SelectItem value="Custom stdio">Custom stdio</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsRegisteringAgent(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" size="sm">
                            Generate API Key
                          </Button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-4">
                      {agentsLoading ? (
                        <div className="p-8 text-center rounded-md border border-dashed border-border bg-muted/20">
                          <p className="text-sm text-muted-foreground font-mono">
                            Loading registered agents…
                          </p>
                        </div>
                      ) : agents.length === 0 ? (
                        <div className="p-8 text-center rounded-md border border-dashed border-border bg-muted/20">
                          <Bot className="size-8 text-foreground/40 mx-auto mb-2" />
                          <p className="text-sm font-medium text-foreground">
                            No agents registered yet
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 font-mono">
                            Register your first agent to mint its exclusive
                            <code className="mx-1">aegis_sec_…</code>
                            MCP key.
                          </p>
                        </div>
                      ) : (
                      agents.map((agent) => {
                        const isRevealed = revealedKeyIds[agent.id] ?? false;
                        const isKeyCopied = copiedKeyId === agent.id;
                        const isCmdCopied = copiedCmdId === agent.id;
                        const shownKey = displayKeyFor(agent);
                        const isConfigCopied = copiedConfigId === shownKey;

                        return (
                          <Card key={agent.id} className="p-5 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                              <div className="flex items-center gap-3">
                                <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                                  <Bot className="size-4" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-foreground flex items-center gap-2">
                                    <span>{agent.name}</span>
                                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <Badge variant="default">
                                      {agent.framework}
                                    </Badge>
                                  </div>
                                  <div className="text-[11px] font-mono text-muted-foreground">
                                    Registered {agent.createdAt} • Stdio MCP
                                    connected
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 font-mono text-sm">
                                <button
                                  onClick={() => toggleRevealKey(agent.id)}
                                  className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title={isRevealed ? "Hide key" : "Reveal key"}
                                >
                                  {isRevealed ? (
                                    <EyeOff className="size-3.5" />
                                  ) : (
                                    <Eye className="size-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    handleCopyKey(agent.id, shownKey)
                                  }
                                  className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Copy key"
                                >
                                  {isKeyCopied ? (
                                    <Check className="size-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3.5" />
                                  )}
                                </button>
                                <code className="text-muted-foreground bg-muted px-2 py-1 rounded border border-border">
                                  {isRevealed
                                    ? shownKey
                                    : `${shownKey.substring(0, 12)}••••••••`}
                                </code>
                                <button
                                  onClick={() =>
                                    handleDeleteAgent(agent.id, agent.name)
                                  }
                                  className="text-[11px] text-muted-foreground hover:text-rose-500 ml-1 cursor-pointer"
                                >
                                  Revoke
                                </button>
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
                                <span>Terminal Launch Command</span>
                                <button
                                  onClick={() =>
                                    handleCopyCmd(agent.id, shownKey)
                                  }
                                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                                >
                                  {isCmdCopied ? (
                                    <>
                                      <Check className="size-3 text-emerald-500" />
                                      <span className="text-emerald-500">
                                        Copied
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div
                                onClick={() =>
                                  handleCopyCmd(agent.id, shownKey)
                                }
                                className="p-2.5 rounded bg-muted/40 border border-border font-mono text-sm text-foreground flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center gap-2 overflow-x-auto">
                                  <Terminal className="size-3.5 text-muted-foreground shrink-0" />
                                  <code>
                                    $ npm install -g ./aegis-402-mcp && aegis-mcp
                                  </code>
                                </div>
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                    IDE Integration Config
                                  </span>
                                  <div className="inline-flex rounded border border-border bg-muted/60 p-0.5">
                                    {(
                                      ["claude", "cursor", "windsurf", "opencode"] as const
                                    ).map((client) => (
                                      <button
                                        key={client}
                                        onClick={() =>
                                          setSelectedConfigClient(client)
                                        }
                                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer capitalize ${
                                          selectedConfigClient === client
                                            ? "bg-background text-foreground"
                                            : "text-muted-foreground"
                                        }`}
                                      >
                                        {CONFIG_CLIENT_LABEL[client]}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    handleCopyConfigSnippet(shownKey)
                                  }
                                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                                >
                                  {isConfigCopied ? (
                                    <>
                                      <Check className="size-3 text-emerald-500" />
                                      <span className="text-emerald-500">
                                        Copied
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-3" />
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-3 rounded bg-muted/40 border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
                                {configSnippetFor(selectedConfigClient, shownKey)}
                              </pre>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                  Worker Bootstrap Prompt
                                </span>
                                <button
                                  onClick={() =>
                                    handleCopyBootstrapPrompt(agent.id, agent.name, shownKey)
                                  }
                                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                                >
                                  {copiedPromptId === agent.id ? (
                                    <>
                                      <Check className="size-3 text-emerald-500" />
                                      <span className="text-emerald-500">
                                        Copied
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-3" />
                                      <span>Copy Prompt</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-3 rounded bg-muted/40 border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
                                {bootstrapPromptFor(agent.name, shownKey, window.location.origin)}
                              </pre>
                            </div>
                          </Card>
                        );
                      })
                      )}
                    </div>
                  </div>
                )}

                {/* VIEW: Escrow Audit (AG Studio) */}
                {activeTab === "audit" && <AuditScreen bounties={bounties} theme={theme} />}

                {/* VIEW: Lease Timeline (Bryntum Scheduler) */}
                {activeTab === "timeline" && (
                  <LeaseTimeline
                    bounties={bounties}
                    theme={theme}
                    onSelectBounty={(b) => {
                      if (b.status === "READY_FOR_REVIEW") onOpenReviewer(b);
                    }}
                  />
                )}

                {/* VIEW: PayPal Authorizations */}
                {activeTab === "escrow" && (
                  <div className="px-4 lg:px-6 space-y-6">
                    <ChartAreaInteractive />
                    <Card className="p-5 space-y-4">
                      <div className="pb-3 border-b border-border">
                        <h2 className="text-base font-medium text-foreground font-mono flex items-center gap-2">
                          <Lock className="size-4" />
                          <span>Payments & Escrow Records</span>
                        </h2>
                        <p className="text-sm text-muted-foreground font-mono">
                          Two-phase commit escrow audit log. Holds are executed
                          with{" "}
                          <code className="text-foreground">
                            intent: "AUTHORIZE"
                          </code>
                          .
                        </p>
                      </div>

                      <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-left font-mono text-sm">
                          <thead className="bg-muted/40 border-b border-border text-muted-foreground text-[10px] uppercase">
                            <tr>
                              <th className="py-2.5 px-4">Authorization ID</th>
                              <th className="py-2.5 px-4">Bounty Title</th>
                              <th className="py-2.5 px-4">Amount</th>
                              <th className="py-2.5 px-4">Two-Phase State</th>
                              <th className="py-2.5 px-4">Code Vault</th>
                              <th className="py-2.5 px-4 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {bounties.map((b) => (
                              <tr
                                key={b.id}
                                className="hover:bg-muted/30 transition-colors"
                              >
                                <td className="py-2.5 px-4 font-mono text-foreground">
                                  {b.payPalAuthorizationId || "—"}
                                </td>
                                <td className="py-2.5 px-4 truncate max-w-[200px] text-foreground">
                                  {b.title}
                                </td>
                                <td className="py-2.5 px-4 font-medium text-foreground">
                                  ${b.escrowAmount.toFixed(2)} USD
                                </td>
                                <td className="py-2.5 px-4">
                                  <Badge
                                    variant={
                                      b.status === "SETTLED"
                                        ? "emerald"
                                        : "paypal"
                                    }
                                  >
                                    {b.status === "SETTLED"
                                      ? "CAPTURED (SETTLED)"
                                      : "AUTHORIZED (LOCKED)"}
                                  </Badge>
                                  <div className="mt-1 text-[10px] font-mono">
                                    {(() => {
                                      const live = escrowLive[b.id];
                                      if (!live)
                                        return (
                                          <span className="text-muted-foreground">
                                            checking lock…
                                          </span>
                                        );
                                      if (live.mode === "DEMO")
                                        return (
                                          <span className="text-muted-foreground">
                                            DEMO — no PayPal lock
                                          </span>
                                        );
                                      if (live.verified)
                                        return (
                                          <span className="text-emerald-500">
                                            ● PayPal {live.status} — funds locked
                                          </span>
                                        );
                                      return (
                                        <span className="text-amber-500">
                                          ● PayPal {live.status ?? live.mode} — NOT locked
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 font-mono text-[11px]">
                                  {!b.artifactSha256 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : b.status !== "SETTLED" ? (
                                    <span className="text-muted-foreground" title={b.artifactSha256}>
                                      sealed {b.artifactSha256.slice(0, 10)}…
                                    </span>
                                  ) : (
                                    <span className="space-y-1 block">
                                      <button
                                        onClick={() => handleDownloadArtifact(b.id)}
                                        disabled={downloadingId === b.id}
                                        className="text-foreground underline underline-offset-2 hover:no-underline cursor-pointer disabled:opacity-50 block"
                                      >
                                        {downloadingId === b.id ? "issuing link…" : "download .tar.gz"}
                                      </button>
                                      <span className="block text-muted-foreground" title={b.invoiceId || "no receipt"}>
                                        receipt: {b.invoiceStatus || "—"}
                                      </span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right text-muted-foreground">
                                  {b.status === "SETTLED" ? (
                                    <span className="space-y-1 block">
                                      <span className="block">Settled</span>
                                      {(!b.payoutBatchId || (b.payoutStatus || "").toUpperCase().startsWith("FAILED") || (b.payoutStatus || "").toUpperCase().startsWith("SKIPPED")) && (
                                        <button
                                          onClick={() => handleRetryPayout(b.id)}
                                          disabled={retryingId === b.id}
                                          className="text-[#0070ba] underline underline-offset-2 hover:no-underline cursor-pointer disabled:opacity-50 block ml-auto"
                                          title={b.payoutStatus || "payout not sent"}
                                        >
                                          {retryingId === b.id ? "retrying…" : "retry payout"}
                                        </button>
                                      )}
                                    </span>
                                  ) : (
                                    "Held in Escrow"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                )}

                {/* VIEW: Settings */}
                {activeTab === "settings" && (
                  <div className="px-4 lg:px-6">
                    <Card className="p-5 space-y-4 font-mono text-sm">
                      <div className="pb-3 border-b border-border">
                        <h2 className="text-base font-medium text-foreground flex items-center gap-2">
                          <Settings className="size-4" />
                          <span>Application Settings</span>
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Manage your workspace preferences, interface
                          appearance, and notifications.
                        </p>
                      </div>

                      <div className="space-y-4 max-w-xl">
                        <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
                          <div>
                            <div className="font-medium text-foreground">
                              Theme Appearance
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Switch between Light and Dark monochrome UI.
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onToggleTheme}
                          >
                            {theme === "dark" ? "Dark Mode" : "Light Mode"}
                          </Button>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
                          <div>
                            <div className="font-medium text-foreground">
                              PayPal Webhooks
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Receive real-time order authorization and
                              settlement callbacks.
                            </div>
                          </div>
                          <Badge variant="emerald">Connected</Badge>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
                          <div>
                            <div className="font-medium text-foreground">
                              Playwright CDP Viewport
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Binary WebP streaming at 1280x720 canvas
                              resolution.
                            </div>
                          </div>
                          <Badge variant="outline">60 FPS Native</Badge>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* VIEW: Profile */}
                {activeTab === "profile" && (
                  <div className="px-4 lg:px-6">
                    <Card className="p-5 space-y-4 font-mono text-sm">
                      <div className="pb-3 border-b border-border">
                        <h2 className="text-base font-medium text-foreground flex items-center gap-2">
                          <User className="size-4" />
                          <span>User Profile</span>
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Your authenticated account credentials and
                          disbursement details.
                        </p>
                      </div>

                      <div className="space-y-3 max-w-xl">
                        <div className="p-3 rounded-md border border-border bg-muted/20 space-y-1">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            Account Email
                          </div>
                          <div className="font-medium text-foreground text-sm">
                            {user.email}
                          </div>
                        </div>

                        <div className="p-3 rounded-md border border-border bg-muted/20 space-y-1">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            Account Role
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">
                              {user.role
                                ? user.role.charAt(0).toUpperCase() +
                                  user.role.slice(1).toLowerCase()
                                : "Member"}
                            </Badge>
                          </div>
                        </div>

                        <div className="p-3 rounded-md border border-border bg-muted/20 space-y-1">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            PayPal Payout Address
                          </div>
                          <div className="font-medium text-foreground">
                            {user.paypalEmail || user.email}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Direct disbursements for completed and verified
                            bounties.
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={onSignOut}
                          >
                            Sign Out of Account
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
