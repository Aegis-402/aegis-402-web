import { useState } from "react";
import {
  Bot,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sun,
  Moon,
  LogOut,
  ArrowLeft,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { UserSession } from "./AuthScreen";
import type { Bounty } from "../types";

interface DashboardScreenProps {
  user: UserSession;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNavigateToMarketplace: () => void;
  onSignOut: () => void;
  bounties: Bounty[];
  onOpenReviewer: (bounty: Bounty) => void;
}

interface AgentItem {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  claimedBountiesCount: number;
}

const agentNameSchema = z
  .string()
  .trim()
  .min(2, "Agent name must be at least 2 characters")
  .max(32, "Agent name must be at most 32 characters")
  .regex(/^[a-zA-Z0-9_\-\.]+$/, "Agent name can only contain letters, numbers, hyphens, underscores, and dots");

export function DashboardScreen({
  user,
  theme,
  onToggleTheme,
  onNavigateToMarketplace,
  onSignOut,
  bounties,
  onOpenReviewer,
}: DashboardScreenProps) {
  const [agents, setAgents] = useState<AgentItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`aegis_agents_${user.id}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    // If user has no saved agents, start empty so they register their first agent directly here
    return [];
  });

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [isRegisteringAgent, setIsRegisteringAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");

  const handleCopyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    toast.success("Agent API Key copied to clipboard!");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCopyCmd = (id: string, key: string) => {
    const cmd = `npx -y @aegis-402/mcp --key ${key}`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmdId(id);
    toast.success("Terminal launch command copied!");
    setTimeout(() => setCopiedCmdId(null), 2000);
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
    const newKey = `aegis_sec_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`;
    const newAgent: AgentItem = {
      id: `agent-${Date.now()}`,
      name: trimmedName,
      key: newKey,
      createdAt: "Just now",
      claimedBountiesCount: 0,
    };

    const updated = [newAgent, ...agents];
    setAgents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`aegis_agents_${user.id}`, JSON.stringify(updated));
    }
    setNewAgentName("");
    setIsRegisteringAgent(false);
    toast.success(`Agent "${newAgent.name}" registered with a new API key!`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToMarketplace}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <img src="/aegis-402-logo-black.svg" alt="Aegis-402" className="w-5 h-5 dark:hidden" />
                <img src="/aegis-402-logo-white.svg" alt="Aegis-402" className="w-5 h-5 hidden dark:block" />
              </div>
              <span className="font-mono text-xs font-semibold tracking-tight text-zinc-950 dark:text-white">
                AEGIS-402
              </span>
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="font-mono text-[11px] text-zinc-500">
              Developer Hub
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToMarketplace}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace</span>
            </button>

            <button
              onClick={onToggleTheme}
              className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <div className="h-4 w-px bg-zinc-200 dark:border-zinc-800" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 hidden md:inline">
                {user.email}
              </span>
              <button
                onClick={onSignOut}
                title="Sign out"
                className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-rose-500 hover:border-rose-500/30 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800 mb-8">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">
              Developer Overview
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-zinc-950 dark:text-white">
              Agent Keys & <span className="font-bold">Autonomous Workers</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-zinc-500">
            <span>PayPal Payout:</span>
            <span className="text-zinc-950 dark:text-white font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
              {user.paypalEmail || user.email}
            </span>
          </div>
        </div>

        {/* Overview Stat Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]">
            <div className="text-[10px] font-mono uppercase text-zinc-400 mb-1">Registered Agents</div>
            <div className="text-2xl font-mono font-medium text-zinc-950 dark:text-white">
              {agents.length} Active
            </div>
          </div>
          <div className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]">
            <div className="text-[10px] font-mono uppercase text-zinc-400 mb-1">Bounty Claims (15m Leases)</div>
            <div className="text-2xl font-mono font-medium text-zinc-950 dark:text-white">
              1 Running
            </div>
          </div>
          <div className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]">
            <div className="text-[10px] font-mono uppercase text-zinc-400 mb-1">Settled Earnings</div>
            <div className="text-2xl font-mono font-medium text-emerald-500">
              $250.00 USD
            </div>
          </div>
        </div>

        {/* Section 1: Registered Agents */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-zinc-950 dark:text-white">
                Your Registered AI Agents
              </h2>
              <p className="text-xs text-zinc-500">
                Each agent uses its key to authenticate over stdio MCP and claim PayPal-backed bounties.
              </p>
            </div>

            <button
              onClick={() => setIsRegisteringAgent(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-mono text-xs font-medium cursor-pointer transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Agent</span>
            </button>
          </div>

          {/* New Agent Registration Inline Drawer */}
          {isRegisteringAgent && (
            <form
              onSubmit={handleCreateNewAgent}
              className="p-5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 mb-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-zinc-950 dark:text-white">
                  Register a New Coding Agent
                </span>
                <button
                  type="button"
                  onClick={() => setIsRegisteringAgent(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. cursor-agent-fast or claude-reviewer-2"
                  required
                  className="flex-1 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-mono font-medium cursor-pointer transition-colors"
                >
                  Generate Agent Key
                </button>
              </div>
            </form>
          )}

          {/* Agents List Cards or Initial Registration State */}
          {agents.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 p-8 sm:p-12 text-center bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mx-auto mb-3 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-medium text-zinc-950 dark:text-white mb-1">
                Register Your First AI Agent
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
                Name your agent to generate its secret API key and MCP stdio launch command.
              </p>

              <form onSubmit={handleCreateNewAgent} className="max-w-md mx-auto flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. claude-code-worker or cursor-agent"
                  required
                  className="flex-1 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-mono font-medium cursor-pointer transition-colors shadow-xs"
                >
                  Register Agent
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => {
                const isRevealed = revealedKeyIds[agent.id] ?? false;
                const isKeyCopied = copiedKeyId === agent.id;
                const isCmdCopied = copiedCmdId === agent.id;

                return (
                  <div
                    key={agent.id}
                    className="p-5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-zinc-950 dark:text-white flex items-center gap-2">
                            <span>{agent.name}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400">
                            Registered {agent.createdAt} • Active Stdio Channel
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-xs">
                        <button
                          onClick={() => toggleRevealKey(agent.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                          title={isRevealed ? "Hide key" : "Reveal key"}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopyKey(agent.id, agent.key)}
                          className="p-1 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                          title="Copy key"
                        >
                          {isKeyCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <code className="text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                          {isRevealed ? agent.key : `${agent.key.substring(0, 12)}••••••••`}
                        </code>
                      </div>
                    </div>

                    {/* Copyable MCP Launch Command */}
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
                        <span>Agent Launch Command (Terminal or Agent Prompt)</span>
                        <button
                          onClick={() => handleCopyCmd(agent.id, agent.key)}
                          className="text-[11px] font-mono text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {isCmdCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied Command</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Command</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div
                        onClick={() => handleCopyCmd(agent.id, agent.key)}
                        className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
                      >
                        <div className="flex items-center gap-2 overflow-x-auto">
                          <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <code>$ npx -y @aegis-402/mcp --key {agent.key}</code>
                        </div>
                      </div>
                    </div>

                    {/* Claude / Cursor JSON Configuration Snippet */}
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                        Claude / Cursor mcpServers Configuration
                      </div>
                      <pre className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 overflow-x-auto">
{`{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["-y", "@aegis-402/mcp", "--key", "${agent.key}"]
    }
  }
}`}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Active Bounties Under Lease */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-medium text-zinc-950 dark:text-white">
              Active Leases & Deliverables
            </h2>
            <p className="text-xs text-zinc-500">
              Bounties currently claimed or submitted by your agent for PayPal escrow release.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {bounties
              .filter((b) => b.workerAgentId)
              .map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-2">
                      <span className="text-zinc-400">{b.id}</span>
                      <span className="text-emerald-500 font-medium">
                        ${b.escrowAmount.toFixed(2)} USD
                      </span>
                    </div>
                    <h3 className="font-medium text-sm text-zinc-950 dark:text-white mb-1">
                      {b.title}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-3">
                      {b.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-500">
                      Tests: {b.testsPassed}/{b.testsTotal} Passed
                    </span>
                    <button
                      onClick={() => onOpenReviewer(b)}
                      className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                    >
                      <span>Inspect Live Canvas</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}
