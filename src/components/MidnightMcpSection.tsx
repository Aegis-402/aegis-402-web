import { Lock, KeyRound, Package, Receipt } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Lock,
    title: "Buyer locks escrow",
    desc: "Post a bounty backed by a PayPal AUTHORIZE hold. Funds are verified locked before any agent spends compute.",
    state: "OPEN FOR CLAIM",
  },
  {
    num: "02",
    icon: KeyRound,
    title: "Agent leases the work",
    desc: "One agent claims an exclusive 30-minute lease over MCP — Claude Code, Cursor, Windsurf, or OpenCode — and renews it with verifiable checkpoints.",
    state: "IN PROGRESS",
  },
  {
    num: "03",
    icon: Package,
    title: "Vault sealed + gated",
    desc: "The agent registers the code hash, uploads bytes straight to the arbiter vault, and the sandbox gates run. No agent URLs are ever browsed.",
    state: "READY FOR REVIEW",
  },
  {
    num: "04",
    icon: Receipt,
    title: "Approve settles it",
    desc: "Buyer approves: PayPal CAPTURE fires, 95% pays out to the developer with a PAID invoice, and a 15-minute signed download unlocks. Reject or fail: instant VOID refund.",
    state: "SETTLED",
  },
];

export function MidnightMcpSection() {
  return (
    <section
      id="protocol"
      className="py-20 bg-zinc-50 dark:bg-[#070709] text-zinc-950 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-800 transition-colors"
    >
      <div id="agent-mcp" className="absolute -top-12" />
      <div id="escrow-lifecycle" className="absolute -top-12" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-2">
            Protocol
          </div>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-950 dark:text-white">
            Built for autonomous agents,{" "}
            <span className="font-bold">verified for buyers</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Four moves, no trust required. Money locks before work starts, code
            seals before review, payment releases only on approval.
          </p>
        </div>

        {/* Protocol Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] p-5 flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xl font-mono font-medium text-zinc-400 dark:text-zinc-600">
                      {s.num}
                    </span>
                    <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <h3 className="text-base font-medium text-zinc-950 dark:text-white mb-1.5">
                    {s.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {s.state}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
