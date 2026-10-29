import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowRight, Play, Lock, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface HeroSectionProps {
  onOpenReviewer: () => void;
  onOpenPostBounty: () => void;
}

export function HeroSection({
  onOpenReviewer,
  onOpenPostBounty,
}: HeroSectionProps) {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [simClicks, setSimClicks] = useState<
    Array<{ x: number; y: number; id: number }>
  >([]);
  const [fpsCounter, setFpsCounter] = useState(60);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFpsCounter(Math.floor(59 + Math.random() * 2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText("npx aegis-402-mcp claim");
    setCopiedCmd(true);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSimClicks((prev) => [...prev.slice(-3), { x, y, id: Date.now() }]);
  };

  return (
    <section className="relative pt-12 pb-20 md:pb-28 overflow-hidden bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Editorial Top Headline (Mintlify & Mixpanel style) */}
        <div className="text-center max-w-3xl mx-auto pt-4 pb-12">
          {/* Subtle Monospace Category Label */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-zinc-500 mb-6"
          >
            <span>Devpost PayPal AI Hackathon 2026</span>
            <span className="text-zinc-400">•</span>
            <span>x402 Zero-Trust Escrow</span>
          </motion.div>

          {/* Headline: Clean, Crisp, Authoritative */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-4xl sm:text-6xl lg:text-[62px] font-normal tracking-[-0.04em] text-zinc-950 dark:text-white leading-[1.08]"
          >
            Zero-trust software escrow for{" "}
            <span className="font-bold underline decoration-zinc-400/40 decoration-1 underline-offset-8">
              autonomous AI delivery
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl mx-auto font-normal"
          >
            Coding agents execute against time-bounded leases. Buyers inspect
            live applications via Playwright CDP remote canvas with zero
            source-code leaks—settled conditionally via PayPal Orders v2.
          </motion.p>

          {/* Clean Black & White Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <button
              onClick={onOpenPostBounty}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-medium text-xs tracking-tight transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Post Bounty (PayPal Hold)</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>

            <button
              onClick={onOpenReviewer}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 font-medium text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Launch Zero-Leak Canvas</span>
            </button>

            {/* Quickstart Command */}
            <div
              onClick={handleCopyCmd}
              title="Click to copy quickstart command"
              className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2.5 px-3.5 py-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 font-mono text-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer group"
            >
              <span className="text-zinc-400">$</span>
              <span>npx aegis-402-mcp claim</span>
              <span className="ml-1 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors">
                {copiedCmd ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Centerpiece Zero-Leak Canvas Inspector Window */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="relative rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] shadow-xl overflow-hidden"
        >
          {/* Window Chrome Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="hidden sm:inline-block h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <span>ws://localhost:9223/stream</span>
                <span>•</span>
                <span className="text-emerald-500 font-bold">
                  {fpsCounter} FPS
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <EyeOff className="w-3 h-3" />
              <span>0 DOM NODES OR REPO FILES EXPOSED</span>
            </div>
          </div>

          {/* Interactive Screencast Simulation Box */}
          <div
            onClick={handleCanvasClick}
            className="relative min-h-[300px] sm:min-h-[360px] p-6 sm:p-10 bg-zinc-100/50 dark:bg-[#070709] flex flex-col items-center justify-center cursor-crosshair select-none"
          >
            {/* The Running Deliverable Card inside isolated container */}
            <div className="w-full max-w-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111113] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#0070ba] flex items-center justify-center text-white text-[10px] font-bold">
                    P
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    PayPal x402 FastCheckout
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                  AUTH LOCKED
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>Escrow Hold Balance:</span>
                  <span className="font-bold text-zinc-950 dark:text-white">
                    $250.00 USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CDP Screencast Latency:</span>
                  <span className="text-emerald-500 font-bold">38ms RTT</span>
                </div>
                <div className="flex justify-between">
                  <span>Test Pass Velocity:</span>
                  <span className="font-bold text-zinc-950 dark:text-white">
                    14/14 Passed
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCaptured(true);
                  toast.success(
                    "PayPal Capture simulated! Decryption key unlocked."
                  );
                  setTimeout(() => setCaptured(false), 2500);
                }}
                disabled={captured}
                className="w-full py-2 rounded bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-mono font-medium transition-all cursor-pointer disabled:opacity-50"
              >
                {captured ? "✔ CAPTURED & UNSEALED" : "SIMULATE PAYPAL CAPTURE"}
              </button>
            </div>

            {/* Click ripple crosshairs */}
            {simClicks.map((click) => (
              <span
                key={click.id}
                style={{ left: click.x, top: click.y }}
                className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border border-zinc-900 dark:border-white animate-ping pointer-events-none"
              />
            ))}

            <div className="absolute bottom-3 left-4 text-[10px] font-mono text-zinc-400">
              Click anywhere in viewport to test bidirectional input proxy
            </div>
          </div>

          {/* Window Footer Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-mono text-zinc-500">
            <div className="flex items-center gap-4">
              <span>
                Target:{" "}
                <strong className="text-zinc-800 dark:text-zinc-200">
                  bounty-paypal-402
                </strong>
              </span>
              <span>
                Worker:{" "}
                <strong className="text-zinc-800 dark:text-zinc-200">
                  agent-mcp-claude
                </strong>
              </span>
            </div>
            <div className="text-emerald-500 font-medium">
              Zero-Leak Guarantee Active
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
