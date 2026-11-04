import { Lock, Bot } from "lucide-react";
import type { Bounty } from "../types";
export type { Bounty };

interface BountyCardProps {
  bounty: Bounty;
  onClaim: (bountyId: string) => void;
}

// Landing-only card: public surface. No lease timers, no stage/test
// telemetry, no reviewer entry — those live in the dashboard behind auth.
export function BountyCard({ bounty, onClaim }: BountyCardProps) {
  const isOpen = bounty.status === "OPEN_FOR_CLAIM";
  const isInProgress = bounty.status === "IN_PROGRESS";
  const isReviewable = bounty.status === "READY_FOR_REVIEW";
  const isSettled = bounty.status === "SETTLED";

  return (
    <div className="flex flex-col justify-between p-5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors group">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {bounty.category}
          </span>

          {/* Status Label */}
          {isOpen && (
            <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Claimable</span>
            </span>
          )}
          {isInProgress && (
            <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>In Progress</span>
            </span>
          )}
          {isReviewable && (
            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              <span>In Review</span>
            </span>
          )}
          {isSettled && (
            <span className="text-[11px] font-mono text-zinc-500">
              Settled
            </span>
          )}
          {!isOpen && !isInProgress && !isReviewable && !isSettled && (
            <span className="text-[11px] font-mono text-zinc-500">
              Refunded
            </span>
          )}
        </div>

        {/* Bounty Title */}
        <h3 className="font-normal text-base text-zinc-950 dark:text-white tracking-tight leading-snug">
          {bounty.title}
        </h3>

        {/* Description */}
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {bounty.description}
        </p>
      </div>

      <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* Escrow Row */}
        <div className="flex items-center justify-end text-sm mb-3 font-mono">
          <div className="text-right">
            <span className="text-zinc-400 text-[10px] block font-mono flex items-center justify-end gap-1">
              <Lock className="w-2.5 h-2.5 text-[#0070ba]" />
              PayPal Hold
            </span>
            <span className="font-mono text-sm font-semibold text-zinc-950 dark:text-white">
              ${bounty.escrowAmount.toFixed(2)} {bounty.currency}
            </span>
          </div>
        </div>

        {/* Action Button */}
        {isOpen ? (
          <button
            onClick={() => onClaim(bounty.id)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-black font-mono text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Claim 30m Lease (MCP)</span>
          </button>
        ) : (
          <div className="w-full py-2 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 text-center font-mono text-sm">
            {isSettled ? "Settled via PayPal Capture" : isReviewable ? "In Review" : isInProgress ? "Lease Active" : "Refunded / Closed"}
          </div>
        )}
      </div>
    </div>
  );
}
