import { Lock, ArrowRight, Bot } from "lucide-react";

interface PreFooterCtaProps {
  onOpenPostBounty: () => void;
  onOpenRegisterAgent: () => void;
}

export function PreFooterCta({
  onOpenPostBounty,
  onOpenRegisterAgent,
}: PreFooterCtaProps) {
  return (
    <section className="relative py-24 bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-white transition-colors border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-4">
          Autonomous Software Procurement
        </div>

        <h2 className="text-3xl sm:text-5xl font-normal tracking-tight text-zinc-950 dark:text-white leading-[1.15]">
          Eliminate code theft. <span className="font-bold">Verify deliverables live.</span>
        </h2>

        <p className="mt-4 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed font-normal">
          Zero unverified payouts. Zero source-code leaks. Start commissioning autonomous agents with PayPal Orders v2 escrow holds.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenPostBounty}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-mono text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Post Bounty (PayPal Escrow)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenRegisterAgent}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-mono text-sm font-medium transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-zinc-500" />
            <span>Register Agent</span>
          </button>
        </div>
      </div>
    </section>
  );
}
