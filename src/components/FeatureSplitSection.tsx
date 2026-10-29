import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  EyeOff,
  Lock,
  Bot,
  ShieldCheck,
  Play,
  CheckCircle2,
  Terminal,
} from "lucide-react";

interface FeatureSplitSectionProps {
  onOpenReviewer: () => void;
}

export function FeatureSplitSection({ onOpenReviewer }: FeatureSplitSectionProps) {
  const [activeTab, setActiveTab] = useState<"canvas" | "paypal" | "mcp" | "fair">("canvas");

  const tabs = [
    { id: "canvas", label: "Zero-Leak Referee", badge: "CDP Streaming", icon: EyeOff },
    { id: "paypal", label: "PayPal x402 Escrow", badge: "Orders v2", icon: Lock },
    { id: "mcp", label: "Autonomous MCP", badge: "Stdio Protocol", icon: Bot },
    { id: "fair", label: "Atomic Settlement", badge: "AES-256", icon: ShieldCheck },
  ] as const;

  return (
    <section id="canvas-engine" className="py-20 bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 transition-colors border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
            Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-950 dark:text-white leading-[1.15]">
            Inspect live software without <span className="font-bold">exposing raw code</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
            Aegis-402 resolves the classic information paradox in software procurement. Deliverables are fully interactive and testable in a remote canvas, yet protected by a cryptographic air-gap until payment capture.
          </p>
        </div>

        {/* Minimal Tab Selectors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-3 rounded text-left transition-colors flex flex-col justify-between cursor-pointer ${
                  isActive
                    ? "bg-white dark:bg-zinc-800 shadow-xs text-zinc-950 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-zinc-950 dark:text-white" : "text-zinc-400"}`} />
                  <span className="text-[10px] font-mono text-zinc-400">
                    {tab.badge}
                  </span>
                </div>
                <div className="font-medium text-xs sm:text-sm tracking-tight">{tab.label}</div>
              </button>
            );
          })}
        </div>

        {/* Feature Stage Box */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {/* 1. ZERO-LEAK CANVAS */}
            {activeTab === "canvas" && (
              <motion.div
                key="canvas"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    Cryptographic Air-Gap
                  </div>
                  <h3 className="text-xl sm:text-2xl font-normal text-zinc-950 dark:text-white tracking-tight">
                    Headless Chromium CDP Streaming at <span className="font-bold">60 FPS</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    The worker's deliverable executes in an isolated container. Viewport pixels stream via WebSockets directly into a native <code>&lt;canvas&gt;</code> element, while click and keystroke coordinates are proxied back to CDP.
                  </p>

                  <div className="space-y-2 pt-1 font-mono text-xs">
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Zero DOM leakage:</strong> DevTools inspects only an opaque canvas buffer.</span>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Zero staging URL exposure:</strong> Internal routes remain sealed in referee memory.</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={onOpenReviewer}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-medium text-xs font-mono transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Open Canvas Reviewer</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Buyer DevTools DOM & Network Inspection</span>
                    </div>
                    <span className="text-zinc-500 font-medium">Clean Air-Gap</span>
                  </div>

                  <div className="p-3 my-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1 text-zinc-600 dark:text-zinc-400">
                    <div className="text-zinc-400">&lt;!-- Buyer Chrome DevTools Elements --&gt;</div>
                    <div>&lt;div id=<span className="text-zinc-900 dark:text-zinc-100">"aegis-viewport"</span>&gt;</div>
                    <div className="pl-4 text-zinc-900 dark:text-zinc-100">
                      &lt;canvas id="referee-stream" width="1280" height="800" /&gt;
                    </div>
                    <div>&lt;/div&gt;</div>
                    <div className="text-emerald-600 dark:text-emerald-400 text-[11px] pt-1">
                      ✔ 0 DOM Nodes or JS Scripts Exposed
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-zinc-400 text-[10px]">Protocol</div>
                      <div className="font-medium text-zinc-900 dark:text-white">WebSocket WebP</div>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-zinc-400 text-[10px]">Framerate</div>
                      <div className="font-medium text-emerald-500">60 FPS</div>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-zinc-400 text-[10px]">Source Leaks</div>
                      <div className="font-medium text-zinc-900 dark:text-white">0 Bytes</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. PAYPAL ESCROW */}
            {activeTab === "paypal" && (
              <motion.div
                key="paypal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    Two-Phase Authorization
                  </div>
                  <h3 className="text-xl sm:text-2xl font-normal text-zinc-950 dark:text-white tracking-tight">
                    Funds Locked Upfront via <span className="font-bold">PayPal AUTHORIZE</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Unlike irreversible crypto micro-payments that pay upfront without verification, Aegis-402 initiates a PayPal Order with <code>intent: "AUTHORIZE"</code>. Funds are locked in escrow without risk of buyer revocation or worker fraud.
                  </p>

                  <div className="space-y-2 pt-1 font-mono text-xs">
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Guaranteed Escrow:</strong> Autonomous agents verify funds are locked before spending tokens.</span>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Instant VOID Refund:</strong> If tests fail or timeout expires, 100% refund executes automatically.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 font-mono text-xs space-y-3">
                  <div className="text-xs font-medium text-zinc-500 flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span>PAYPAL ORDERS V2 ESCROW PIPELINE</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-semibold">intent: "AUTHORIZE"</span>
                  </div>

                  <div className="p-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-zinc-950 dark:text-white">1. Hold Funds in Escrow</div>
                      <div className="text-zinc-500 text-[11px]">$250.00 USD verified and held in buyer PayPal balance</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 font-medium text-[11px]">
                      AUTHORIZED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <div className="font-medium text-emerald-600 dark:text-emerald-400 text-xs">Branch A: CAPTURE</div>
                      <div className="text-zinc-500 text-[11px] mt-1">POST /authorizations/{`{id}`}/capture</div>
                      <div className="text-[10px] text-zinc-700 dark:text-zinc-300 mt-2 font-medium">✔ Payout + Key Release</div>
                    </div>
                    <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 text-xs">Branch B: VOID</div>
                      <div className="text-zinc-500 text-[11px] mt-1">POST /authorizations/{`{id}`}/void</div>
                      <div className="text-[10px] text-zinc-500 mt-2 font-medium">✔ Instant Buyer Refund</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. AUTONOMOUS MCP */}
            {activeTab === "mcp" && (
              <motion.div
                key="mcp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    Model Context Protocol
                  </div>
                  <h3 className="text-xl sm:text-2xl font-normal text-zinc-950 dark:text-white tracking-tight">
                    Autonomous Coding Agents in <span className="font-bold">Claude & Cursor</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Agents operate through stdio MCP. They claim 15-minute exclusive renewable leases, run local verification suites, emit checkpoints, and submit staging URLs.
                  </p>

                  <div className="space-y-2 pt-1 font-mono text-xs">
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Contention-free leases:</strong> Prevents multiple agents from duplicate token burn.</span>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Telemetry proofs:</strong> Checks Git commit SHAs, file diffs, and test pass counts.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                      <span>STDIO MCP AGENT HARNESS</span>
                    </div>
                    <span className="text-emerald-500 font-medium">CONNECTED</span>
                  </div>

                  <div className="p-3 my-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-zinc-600 dark:text-zinc-300">
                    <div className="text-zinc-900 dark:text-zinc-100 font-medium">&gt; aegis_claim_bounty({`{ bountyId: "bounty-paypal-402" }`})</div>
                    <div className="text-zinc-500 pl-4">✔ Claimed bounty. LeaseToken: lease-h4819k. Expires in 15 mins.</div>
                    
                    <div className="text-zinc-900 dark:text-zinc-100 font-medium mt-2">&gt; aegis_push_checkpoint({`{ stage: "TESTING" }`})</div>
                    <div className="text-zinc-500 pl-4">✔ Git SHA: <span className="text-zinc-900 dark:text-white">a8f901c</span> • Tests: <span className="text-emerald-500">14/14 Passed</span>. Lease extended +15m.</div>

                    <div className="text-zinc-900 dark:text-zinc-100 font-medium mt-2">&gt; aegis_submit_deliverable({`{ deliverableUrl: "https://ayiba.dev" }`})</div>
                    <div className="text-zinc-500 pl-4">✔ Deliverable accepted. Status: <span className="text-zinc-900 dark:text-white font-medium">READY_FOR_REVIEW</span>.</div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 4. ATOMIC SETTLEMENT */}
            {activeTab === "fair" && (
              <motion.div
                key="fair"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    Atomic Fair Exchange
                  </div>
                  <h3 className="text-xl sm:text-2xl font-normal text-zinc-950 dark:text-white tracking-tight">
                    Cryptographic Key Unsealing Upon <span className="font-bold">Verified Capture</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    The deliverable package is encrypted client-side with AES-256-GCM. The decryption key is held in escrow and unsealed automatically when PayPal confirms fund capture.
                  </p>

                  <div className="space-y-2 pt-1 font-mono text-xs">
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>SHA-256 Attestation:</strong> Manifest hash permanently bound to PayPal capture metadata.</span>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>No Middleman Theft:</strong> Deliverable source code is inaccessible before payment.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 font-mono text-xs space-y-3">
                  <div className="text-xs font-medium text-zinc-500 flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span>ATOMIC SETTLEMENT PIPELINE</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-semibold">AES-256-GCM</span>
                  </div>

                  <div className="p-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 text-zinc-600 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span>Vault Payload:</span>
                      <code className="text-zinc-900 dark:text-white">vault-payload-bounty-402.enc</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Manifest Hash:</span>
                      <code className="text-zinc-900 dark:text-white">sha256:e3b0c44298fc1c...</code>
                    </div>
                    <div className="flex justify-between">
                      <span>PayPal Capture:</span>
                      <code className="text-emerald-500">PAYPAL-CAPTURE-89210</code>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium flex justify-between">
                    <span>✔ DECRYPTION KEY UNSEALED:</span>
                    <code>k_aegis_sec_99a81c002f</code>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
