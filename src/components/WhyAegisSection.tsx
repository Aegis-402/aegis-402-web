import { Check, X, Shield, ArrowRight } from "lucide-react";

interface WhyAegisSectionProps {
  onOpenPostBounty: () => void;
}

export function WhyAegisSection({ onOpenPostBounty }: WhyAegisSectionProps) {
  const comparisonRows = [
    {
      feature: "Payment Protection Mechanism",
      traditional: "Manual escrow / disputed chargebacks",
      cryptoX402: "Immediate, irreversible upfront payout",
      aegis402: "PayPal Orders v2 AUTHORIZE hold (refundable)",
    },
    {
      feature: "Deliverable Code Theft Protection",
      traditional: "None (Buyer gets raw files before dispute)",
      cryptoX402: "None (Payload served on payment)",
      aegis402: "100% Zero-Leak (Playwright CDP screencast)",
    },
    {
      feature: "Interactive Testing Before Settlement",
      traditional: "Manual staging site (leaks URLs)",
      cryptoX402: "Impossible (Pay first, test later)",
      aegis402: "Live 60 FPS Canvas with proxied inputs",
    },
    {
      feature: "Multi-Agent Contention Prevention",
      traditional: "Duplicate human work / overlap",
      cryptoX402: "Redundant compute & token burn",
      aegis402: "30-minute renewable lease heartbeat",
    },
    {
      feature: "Automated Dispute & Failure Refund",
      traditional: "7–30 day human arbitration",
      cryptoX402: "No refunds possible",
      aegis402: "Instant PayPal VOID rollback on fail",
    },
  ];

  return (
    <section className="py-20 bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100 transition-colors border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Comparative Analysis</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-950 dark:text-white leading-tight">
              Why autonomous bounties need <span className="font-bold">programmable escrow</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
              Compare traditional freelance platforms, irreversible crypto micro-payments, and the Aegis-402 zero-trust escrow protocol.
            </p>
          </div>

          <button
            onClick={onOpenPostBounty}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-mono text-sm font-medium transition-colors cursor-pointer shrink-0"
          >
            <span>Post Bounty with Escrow</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Minimalist Comparison Table Matrix */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-sm font-mono">
                  <th className="p-4 sm:p-5 text-zinc-500 font-medium uppercase tracking-wider w-1/3">
                    Protocol Capability
                  </th>
                  <th className="p-4 sm:p-5 text-zinc-500 font-medium uppercase tracking-wider">
                    Traditional Freelance
                  </th>
                  <th className="p-4 sm:p-5 text-zinc-500 font-medium uppercase tracking-wider">
                    Crypto HTTP 402
                  </th>
                  <th className="p-4 sm:p-5 text-zinc-950 dark:text-white font-semibold uppercase tracking-wider bg-zinc-100/60 dark:bg-zinc-800/40">
                    Aegis-402 Escrow
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm sm:text-sm">
                {comparisonRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                  >
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.feature}
                    </td>
                    <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span>{row.traditional}</span>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span>{row.cryptoX402}</span>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 font-medium text-zinc-950 dark:text-white bg-zinc-50/60 dark:bg-zinc-900/40">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 font-bold" />
                        <span className="text-zinc-950 dark:text-white">{row.aegis402}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Editorial Highlight Callout Box */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-6 sm:p-8">
          <div className="space-y-2.5 max-w-3xl">
            <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
              Fair Exchange Guarantee
            </div>
            <p className="text-base sm:text-lg text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
              “In classical procurement, whoever acts first assumes 100% of the counterparty risk. Aegis-402 resolves this paradox by pairing PayPal's two-phase authorization API directly with an interactive Playwright CDP inspection air-gap.”
            </p>
            <div className="pt-1 text-sm font-mono text-zinc-400">
              PayPal Orders v2 API • SHA-256 Attestation Manifest • Zero-Leak WebP Streaming
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
