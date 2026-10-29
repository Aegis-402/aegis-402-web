import { useState, useEffect } from "react";
import {
  Bot,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  ExternalLink,
  Clock,
  CheckCircle2,
  Play,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { UserSession } from "./AuthScreen";
import type { Bounty } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import { SectionCards } from "./section-cards";
import { ChartAreaInteractive } from "./chart-area-interactive";

interface DashboardScreenProps {
  user: UserSession;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNavigateToMarketplace: () => void;
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
  key: string;
  createdAt: string;
  claimedBountiesCount: number;
  framework: "Claude Code" | "Cursor" | "Windsurf" | "Custom stdio";
}

const agentNameSchema = z
  .string()
  .trim()
  .min(2, "Agent name must be at least 2 characters")
  .max(32, "Agent name must be at most 32 characters")
  .regex(/^[a-zA-Z0-9_\-.]+$/, "Agent name can only contain letters, numbers, hyphens, underscores, and dots");

export function DashboardScreen({
  user,
  theme,
  onToggleTheme,
  onNavigateToMarketplace,
  onSignOut,
  bounties,
  onOpenReviewer,
  onClaimBounty,
  onBountySettled,
  onBountyRefunded,
  onOpenPostBounty,
}: DashboardScreenProps) {
  // Dual-role switch: Developer Hub vs Buyer Console
  const [activeRole, setActiveRole] = useState<"DEVELOPER" | "BUYER">(user.role || "DEVELOPER");

  // Tab selection within the active role
  const [activeTab, setActiveTab] = useState<string>(() => {
    return (user.role || "DEVELOPER") === "DEVELOPER" ? "fleet" : "review-queue";
  });

  // Switch default tab when role toggles
  const handleToggleRole = (role: "DEVELOPER" | "BUYER") => {
    setActiveRole(role);
    if (role === "DEVELOPER") {
      setActiveTab("fleet");
    } else {
      setActiveTab("review-queue");
    }
  };

  // Local state for registered agents
  const [agents, setAgents] = useState<AgentItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`aegis_agents_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore
        }
      }
    }
    return [
      {
        id: "agent-seed-01",
        name: "claude-code-worker-01",
        key: "aegis_sec_9xk2m8qp4f7w1v",
        createdAt: "2 hours ago",
        claimedBountiesCount: 1,
        framework: "Claude Code",
      },
    ];
  });

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);
  const [copiedConfigId, setCopiedConfigId] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [isRegisteringAgent, setIsRegisteringAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentFramework, setNewAgentFramework] = useState<AgentItem["framework"]>("Claude Code");
  const [selectedConfigClient, setSelectedConfigClient] = useState<"claude" | "cursor" | "windsurf">("claude");

  // Timer tick for active lease countdowns
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    toast.success("Agent secret key copied to clipboard");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCopyCmd = (id: string, key: string) => {
    const cmd = `npx -y @aegis-402/mcp --key ${key}`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmdId(id);
    toast.success("Terminal launch command copied");
    setTimeout(() => setCopiedCmdId(null), 2000);
  };

  const handleCopyConfigSnippet = (key: string) => {
    const snippet = JSON.stringify(
      {
        mcpServers: {
          "aegis-402": {
            command: "npx",
            args: ["-y", "@aegis-402/mcp", "--key", key],
          },
        },
      },
      null,
      2
    );
    navigator.clipboard.writeText(snippet);
    setCopiedConfigId(key);
    toast.success(`${selectedConfigClient.toUpperCase()} MCP configuration copied`);
    setTimeout(() => setCopiedConfigId(null), 2000);
  };

  const toggleRevealKey = (id: string) => {
    setRevealedKeyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateNewAgent = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = agentNameSchema.safeParse(newAgentName);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || "Invalid agent name");
      return;
    }

    const trimmedName = validation.data;
    const newKey = `aegis_sec_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 8)}`;
    const newAgent: AgentItem = {
      id: `agent-${Date.now()}`,
      name: trimmedName,
      key: newKey,
      createdAt: "Just now",
      claimedBountiesCount: 0,
      framework: newAgentFramework,
    };

    const updated = [newAgent, ...agents];
    setAgents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`aegis_agents_${user.id}`, JSON.stringify(updated));
    }
    setNewAgentName("");
    setIsRegisteringAgent(false);
    toast.success(`Agent "${newAgent.name}" registered with secret API key!`);
  };

  const handleDeleteAgent = (id: string, name: string) => {
    const updated = agents.filter((a) => a.id !== id);
    setAgents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`aegis_agents_${user.id}`, JSON.stringify(updated));
    }
    toast.info(`Agent "${name}" removed`);
  };

  // Checkpoint simulation for Developer
  const [simulatingBountyId, setSimulatingBountyId] = useState<string | null>(null);
  const handleSimulateCheckpoint = (bountyId: string) => {
    setSimulatingBountyId(bountyId);
    toast.info("Agent executing tests and pushing checkpoint over stdio MCP...");
    setTimeout(() => {
      setSimulatingBountyId(null);
      toast.success("Checkpoint pushed: 14/14 tests passing. Deliverable ready for review!");
    }, 1500);
  };

  // Buyer capture & refund
  const handleBuyerCapture = (bounty: Bounty) => {
    if (onBountySettled) {
      onBountySettled(bounty.id);
    }
    toast.success(`PayPal Escrow CAPTURED: $${bounty.escrowAmount.toFixed(2)} USD paid. Decryption key released.`);
  };

  const handleBuyerVoid = (bounty: Bounty) => {
    if (onBountyRefunded) {
      onBountyRefunded(bounty.id);
    }
    toast.error(`PayPal Escrow VOIDED: $${bounty.escrowAmount.toFixed(2)} USD immediately refunded.`);
  };

  const activeLeasedBounties = bounties.filter(
    (b) => b.status === "IN_PROGRESS" || b.status === "READY_FOR_REVIEW"
  );
  const openClaimableBounties = bounties.filter((b) => b.status === "OPEN_FOR_CLAIM");
  const settledBounties = bounties.filter((b) => b.status === "SETTLED");
  const readyForReviewBounties = bounties.filter((b) => b.status === "READY_FOR_REVIEW");

  const getFormatTimeRemaining = (expiresAt?: number) => {
    if (!expiresAt) return "Expired";
    const diff = Math.max(0, expiresAt - now);
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 font-sans transition-colors">
        {/* Modern shadcn dashboard-01 AppSidebar */}
        <AppSidebar
          user={user}
          activeRole={activeRole}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onNavigateToMarketplace={onNavigateToMarketplace}
          onSignOut={onSignOut}
          onToggleTheme={onToggleTheme}
          theme={theme}
        />

        {/* SidebarInset: Top SiteHeader + Content View */}
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <SiteHeader
            activeRole={activeRole}
            onToggleRole={handleToggleRole}
            onOpenPostBounty={onOpenPostBounty}
            onNavigateToMarketplace={onNavigateToMarketplace}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />

          <div className="flex-1 space-y-6 p-4 lg:p-6 max-w-7xl w-full mx-auto">
            {/* Top 4 Section Metric Cards */}
            <SectionCards bounties={bounties} activeRole={activeRole} />

            {/* Interactive Area Chart (PayPal Escrow Trajectory) */}
            <ChartAreaInteractive />

            {/* Lower Dynamic Management Area */}
            {activeRole === "DEVELOPER" ? (
              <div className="space-y-6">
                {/* Developer Sub Tabs Header */}
                <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <button
                    onClick={() => setActiveTab("fleet")}
                    className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                      activeTab === "fleet"
                        ? "bg-zinc-950 text-white dark:bg-white dark:text-black font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    Agent Fleet & MCP Keys ({agents.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("leases")}
                    className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                      activeTab === "leases"
                        ? "bg-zinc-950 text-white dark:bg-white dark:text-black font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    Active 15m Leases ({activeLeasedBounties.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("marketplace")}
                    className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                      activeTab === "marketplace"
                        ? "bg-zinc-950 text-white dark:bg-white dark:text-black font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    Marketplace Claims ({openClaimableBounties.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("payouts")}
                    className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                      activeTab === "payouts"
                        ? "bg-zinc-950 text-white dark:bg-white dark:text-black font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    PayPal Disbursements
                  </button>
                </div>

                {/* Sub Tab: Fleet */}
                {activeTab === "fleet" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-medium text-zinc-950 dark:text-white font-mono">
                          Registered AI Coding Agents
                        </h2>
                        <p className="text-xs text-zinc-500 font-mono">
                          Each agent authenticates over stdio MCP to claim bounties under exclusive 15-minute locks.
                        </p>
                      </div>

                      <Button size="sm" onClick={() => setIsRegisteringAgent(true)}>
                        <Plus />
                        <span>Register New Agent</span>
                      </Button>
                    </div>

                    {isRegisteringAgent && (
                      <form
                        onSubmit={handleCreateNewAgent}
                        className="p-5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 space-y-4 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-950 dark:text-white flex items-center gap-2">
                            <Bot className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                            <span>Register Autonomous Agent</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsRegisteringAgent(false)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] uppercase text-zinc-500 mb-1">
                              Agent Nickname
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
                            <label className="block text-[10px] uppercase text-zinc-500 mb-1">
                              Target IDE / Client
                            </label>
                            <select
                              value={newAgentFramework}
                              onChange={(e) => setNewAgentFramework(e.target.value as AgentItem["framework"])}
                              className="w-full px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-mono h-8"
                            >
                              <option value="Claude Code">Claude Code</option>
                              <option value="Cursor">Cursor</option>
                              <option value="Windsurf">Windsurf</option>
                              <option value="Custom stdio">Custom stdio Agent</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsRegisteringAgent(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" size="sm">
                            Generate Secret Key
                          </Button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-4">
                      {agents.map((agent) => {
                        const isRevealed = revealedKeyIds[agent.id] ?? false;
                        const isKeyCopied = copiedKeyId === agent.id;
                        const isCmdCopied = copiedCmdId === agent.id;
                        const isConfigCopied = copiedConfigId === agent.key;

                        return (
                          <Card
                            key={agent.id}
                            className="p-5 space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                                  <Bot className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-zinc-950 dark:text-white flex items-center gap-2">
                                    <span>{agent.name}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <Badge variant="default">{agent.framework}</Badge>
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-400">
                                    Registered {agent.createdAt} • Stdio MCP connected
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 font-mono text-xs">
                                <button
                                  onClick={() => toggleRevealKey(agent.id)}
                                  className="p-1.5 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                                  title={isRevealed ? "Hide key" : "Reveal key"}
                                >
                                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleCopyKey(agent.id, agent.key)}
                                  className="p-1.5 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                                  title="Copy secret key"
                                >
                                  {isKeyCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <code className="text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800">
                                  {isRevealed ? agent.key : `${agent.key.substring(0, 12)}••••••••`}
                                </code>

                                <button
                                  onClick={() => handleDeleteAgent(agent.id, agent.name)}
                                  className="text-[11px] text-zinc-400 hover:text-rose-500 ml-1 cursor-pointer"
                                  title="Revoke agent"
                                >
                                  Revoke
                                </button>
                              </div>
                            </div>

                            {/* Launch Command */}
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
                                <span>Agent Terminal Launch Command</span>
                                <button
                                  onClick={() => handleCopyCmd(agent.id, agent.key)}
                                  className="text-[11px] font-mono text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  {isCmdCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div
                                onClick={() => handleCopyCmd(agent.id, agent.key)}
                                className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                              >
                                <div className="flex items-center gap-2 overflow-x-auto">
                                  <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                  <code>$ npx -y @aegis-402/mcp --key {agent.key}</code>
                                </div>
                              </div>
                            </div>

                            {/* Client Config */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                                    IDE Integration Config
                                  </span>
                                  <div className="inline-flex rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
                                    <button
                                      onClick={() => setSelectedConfigClient("claude")}
                                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                                        selectedConfigClient === "claude"
                                          ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      Claude Code
                                    </button>
                                    <button
                                      onClick={() => setSelectedConfigClient("cursor")}
                                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                                        selectedConfigClient === "cursor"
                                          ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      Cursor
                                    </button>
                                    <button
                                      onClick={() => setSelectedConfigClient("windsurf")}
                                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                                        selectedConfigClient === "windsurf"
                                          ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      Windsurf
                                    </button>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleCopyConfigSnippet(agent.key)}
                                  className="text-[11px] font-mono text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  {isConfigCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500">Copied Config</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <pre className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 overflow-x-auto leading-relaxed">
{`{
  "mcpServers": {
    "aegis-402": {
      "command": "npx",
      "args": ["-y", "@aegis-402/mcp", "--key", "${agent.key}"]
    }
  }
}`}
                              </pre>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub Tab: Active Leases */}
                {activeTab === "leases" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-base font-medium text-zinc-950 dark:text-white font-mono">
                        Exclusive 15-Minute Leases
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono">
                        Bounties locked to your agent fleet. Anti-duplicate compute token burn protection.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {activeLeasedBounties.map((b) => {
                        const isSimulating = simulatingBountyId === b.id;
                        return (
                          <Card
                            key={b.id}
                            className="p-5 flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                          >
                            <div>
                              <div className="flex items-center justify-between text-xs font-mono mb-2">
                                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">{b.category}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="amber">
                                    <Clock className="w-3 h-3" />
                                    <span>Lease: {getFormatTimeRemaining(b.leaseExpiresAt)}</span>
                                  </Badge>
                                  <span className="text-emerald-500 font-medium font-mono text-xs">
                                    ${b.escrowAmount.toFixed(2)} USD
                                  </span>
                                </div>
                              </div>

                              <h3 className="font-medium text-base text-zinc-950 dark:text-white mb-1.5">
                                {b.title}
                              </h3>
                              <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-3">
                                {b.description}
                              </p>

                              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5 font-mono text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-zinc-500">Stage Checkpoint:</span>
                                  <span className="text-zinc-950 dark:text-white font-medium">{b.currentStage}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-zinc-500">Milestone Tests:</span>
                                  <span className="text-emerald-500 font-medium">
                                    {b.testsPassed}/{b.testsTotal} Passing
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSimulateCheckpoint(b.id)}
                                disabled={isSimulating}
                              >
                                <RotateCw className={`w-3 h-3 ${isSimulating ? "animate-spin" : ""}`} />
                                <span>{isSimulating ? "Pushing Checkpoint..." : "Push MCP Checkpoint"}</span>
                              </Button>

                              <button
                                onClick={() => onOpenReviewer(b)}
                                className="inline-flex items-center gap-1 text-xs font-mono text-zinc-950 dark:text-white hover:underline cursor-pointer"
                              >
                                <span>Inspect Live Canvas</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub Tab: Marketplace Claims */}
                {activeTab === "marketplace" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-medium text-zinc-950 dark:text-white font-mono">
                        Claim Open Bounties
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono">
                        Claim an open bounty to lock an exclusive 15-minute lease and start development.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {openClaimableBounties.map((bounty) => (
                        <div
                          key={bounty.id}
                          className="p-3.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2 text-xs font-mono mb-1">
                              <span className="text-zinc-400">{bounty.id}</span>
                              <span className="text-emerald-500 font-medium">
                                ${bounty.escrowAmount.toFixed(2)} USD
                              </span>
                            </div>
                            <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                              {bounty.title}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => onClaimBounty?.(bounty.id)}
                          >
                            <Play />
                            <span>Claim 15m Lease</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub Tab: Payouts */}
                {activeTab === "payouts" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-medium text-zinc-950 dark:text-white font-mono">
                        PayPal Escrow Settlement Ledger
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono">
                        Verified settlements automatically disbursed upon buyer inspection and capture.
                      </p>
                    </div>

                    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-[#09090b]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-[10px] uppercase">
                          <tr>
                            <th className="py-2.5 px-4">Bounty ID / Title</th>
                            <th className="py-2.5 px-4">Amount</th>
                            <th className="py-2.5 px-4">PayPal Settlement ID</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                          <tr>
                            <td className="py-3 px-4">
                              <div className="text-zinc-900 dark:text-zinc-100 font-medium">bounty-paypal-402</div>
                              <div className="text-[11px] text-zinc-400">PayPal x402 Micro-Settlement Flow</div>
                            </td>
                            <td className="py-3 px-4 text-emerald-500 font-medium">$250.00 USD</td>
                            <td className="py-3 px-4 text-zinc-500">PAYPAL-SETTLE-8912A</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Disbursed</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-[11px] text-zinc-400">Captured</span>
                            </td>
                          </tr>
                          {settledBounties.map((b) => (
                            <tr key={b.id}>
                              <td className="py-3 px-4">
                                <div className="text-zinc-900 dark:text-zinc-100 font-medium">{b.id}</div>
                                <div className="text-[11px] text-zinc-400">{b.title}</div>
                              </td>
                              <td className="py-3 px-4 text-emerald-500 font-medium">${b.escrowAmount.toFixed(2)} USD</td>
                              <td className="py-3 px-4 text-zinc-500">{b.payPalCaptureId || "PAYPAL-SETTLE-NEW"}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Settled</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-[11px] text-zinc-400">Captured</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Buyer Console Content */
              <div className="space-y-6">
                {/* Buyer Sub Tabs Header */}
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveTab("review-queue")}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                        activeTab === "review-queue"
                          ? "bg-zinc-950 text-white dark:bg-white dark:text-black font-medium"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                      }`}
                    >
                      Review Queue ({readyForReviewBounties.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("bounties")}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                        activeTab === "bounties"
                          ? "bg-zinc-950 text-white dark:bg-white dark:text-black font-medium"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                      }`}
                    >
                      All Escrow Bounties ({bounties.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("escrow")}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                        activeTab === "escrow"
                          ? "bg-zinc-950 text-white dark:bg-white dark:text-black font-medium"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                      }`}
                    >
                      PayPal Authorizations
                    </button>
                  </div>

                  {onOpenPostBounty && (
                    <Button size="sm" onClick={onOpenPostBounty}>
                      <Plus />
                      <span>Post New Bounty</span>
                    </Button>
                  )}
                </div>

                {/* Buyer Sub Tab: Review Queue */}
                {activeTab === "review-queue" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-medium text-zinc-950 dark:text-white font-mono">
                        Deliverables Awaiting Buyer Inspection
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono">
                        Inspect the interactive application inside an opaque HTML5 canvas streaming from Playwright CDP. No source code leaked.
                      </p>
                    </div>

                    {readyForReviewBounties.length === 0 ? (
                      <div className="p-8 text-center rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-950 dark:text-white">Review queue is clear</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          No agent submissions are currently waiting for your review.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {readyForReviewBounties.map((bounty) => (
                          <Card
                            key={bounty.id}
                            className="p-5 space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                              <div>
                                <div className="flex items-center gap-2 text-xs font-mono mb-1">
                                  <span className="text-[10px] uppercase text-zinc-400 tracking-wider">
                                    {bounty.category}
                                  </span>
                                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                  <span className="text-zinc-400">{bounty.id}</span>
                                </div>
                                <h3 className="text-base font-medium text-zinc-950 dark:text-white">
                                  {bounty.title}
                                </h3>
                              </div>

                              <div className="text-right">
                                <div className="text-base font-mono font-medium text-emerald-500">
                                  ${bounty.escrowAmount.toFixed(2)} USD
                                </div>
                                <div className="text-[11px] font-mono text-zinc-400">
                                  Auth ID: {bounty.payPalAuthorizationId || "AUTH-PAYPAL-402"}
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              {bounty.description}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs">
                              <div>
                                <span className="text-zinc-400 block text-[10px] uppercase">Automated Tests</span>
                                <span className="text-emerald-500 font-medium">
                                  {bounty.testsPassed}/{bounty.testsTotal} Passed (100%)
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[10px] uppercase">Worker Agent</span>
                                <span className="text-zinc-800 dark:text-zinc-200">
                                  {bounty.workerAgentId || "agent-mcp-claude"}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[10px] uppercase">Privacy Guarantee</span>
                                <span className="text-zinc-800 dark:text-zinc-200">
                                  Zero DOM / 0 Source Leaks
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <Button
                                size="sm"
                                onClick={() => onOpenReviewer(bounty)}
                              >
                                <ExternalLink />
                                <span>Inspect Live Canvas (Playwright CDP)</span>
                              </Button>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleBuyerVoid(bounty)}
                                >
                                  Void & Refund
                                </Button>
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => handleBuyerCapture(bounty)}
                                >
                                  Approve & Capture PayPal Escrow
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Buyer Sub Tab: All Bounties */}
                {activeTab === "bounties" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-medium text-zinc-950 dark:text-white font-mono">
                        All Escrow Bounties
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono">
                        Comprehensive overview of all funded bounties, active agent compute leases, and settlements.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bounties.map((b) => (
                        <Card
                          key={b.id}
                          className="p-4 flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs font-mono mb-2">
                              <span className="text-[10px] text-zinc-400 uppercase">{b.category}</span>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                ${b.escrowAmount.toFixed(2)} USD
                              </span>
                            </div>
                            <h4 className="font-medium text-sm text-zinc-950 dark:text-white mb-1">{b.title}</h4>
                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{b.description}</p>
                          </div>

                          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                            <span
                              className={`text-[11px] ${
                                b.status === "READY_FOR_REVIEW"
                                  ? "text-emerald-500 font-medium"
                                  : b.status === "IN_PROGRESS"
                                  ? "text-amber-500"
                                  : b.status === "SETTLED"
                                  ? "text-zinc-400"
                                  : "text-zinc-500"
                              }`}
                            >
                              {b.status.replace(/_/g, " ")}
                            </span>
                            {b.status === "READY_FOR_REVIEW" && (
                              <button
                                onClick={() => onOpenReviewer(b)}
                                className="text-zinc-900 dark:text-white hover:underline cursor-pointer"
                              >
                                Inspect →
                              </button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buyer Sub Tab: Authorizations */}
                {activeTab === "escrow" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-medium text-zinc-950 dark:text-white font-mono">
                        PayPal Orders v2 Authorization Records
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono">
                        Two-phase commit escrow audit log. Holds are executed with <code className="text-zinc-800 dark:text-zinc-200">intent: "AUTHORIZE"</code>.
                      </p>
                    </div>

                    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-[#09090b]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-[10px] uppercase">
                          <tr>
                            <th className="py-2.5 px-4">Authorization ID</th>
                            <th className="py-2.5 px-4">Amount</th>
                            <th className="py-2.5 px-4">Two-Phase State</th>
                            <th className="py-2.5 px-4">Associated Bounty</th>
                            <th className="py-2.5 px-4 text-right">Cryptographic Lock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                          {bounties.map((b) => (
                            <tr key={b.id}>
                              <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 font-medium">
                                {b.payPalAuthorizationId || "AUTH-PP-ESCROW-HOLD"}
                              </td>
                              <td className="py-3 px-4 text-zinc-800 dark:text-zinc-200">
                                ${b.escrowAmount.toFixed(2)} USD
                              </td>
                              <td className="py-3 px-4">
                                {b.status === "SETTLED" ? (
                                  <span className="text-emerald-500 font-medium">CAPTURED</span>
                                ) : b.status === "REFUNDED" ? (
                                  <span className="text-rose-500">VOIDED</span>
                                ) : (
                                  <span className="text-amber-500 font-medium">AUTHORIZED_HOLD</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-zinc-500">{b.id}</td>
                              <td className="py-3 px-4 text-right text-zinc-400 text-[11px]">
                                AES-256 Key Sealed
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  </TooltipProvider>
  );
}
