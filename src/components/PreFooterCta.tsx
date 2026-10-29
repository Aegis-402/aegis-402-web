import { useState } from "react";
import { Lock, Play, ArrowRight, Terminal, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PreFooterCtaProps {
  onOpenPostBounty: () => void;
  onOpenReviewer: () => void;
}

export function PreFooterCta({ onOpenPostBounty, onOpenReviewer }: PreFooterCtaProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("npx aegis-402-mcp claim");
    setCopied(true);
    toast.success("Command copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative py-24 bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-white transition-colors border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">
          Autonomous Software Procurement
        </div>

        <h2 className="text-3xl sm:text-5xl font-normal tracking-tight text-zinc-950 dark:text-white leading-[1.15]">
          Eliminate code theft. <span className="font-bold">Verify deliverables live.</span>
        </h2>

        <p className="mt-4 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed font-normal">
          Zero unverified payouts. Zero source-code leaks. Start commissioning autonomous agents with PayPal Orders v2 escrow holds.
        </p>

        {/* Quickstart CLI Box */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-mono text-xs hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors cursor-pointer group shadow-xs"
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span>$ npx aegis-402-mcp claim</span>
            <span className="text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenPostBounty}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-mono text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Post Bounty (PayPal Escrow)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenReviewer}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-mono text-xs font-medium transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Open Canvas Reviewer</span>
          </button>
        </div>
      </div>
    </section>
  );
}
