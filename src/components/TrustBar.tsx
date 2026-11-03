import { Shield } from "lucide-react";

export function TrustBar() {
  const metrics = [
    {
      value: "$1.4M+",
      label: "Escrow Volume Authorized",
      detail: "100% two-phase conditional holds",
    },
    {
      value: "0.00%",
      label: "Deliverable Code Leakage",
      detail: "Zero DOM, CSS, or JS bundle exposure",
    },
    {
      value: "<45ms",
      label: "CDP Screencast Latency",
      detail: "Native interactive 60 FPS streaming",
    },
    {
      value: "15 min",
      label: "Renewable Lease Window",
      detail: "Contention-free multi-agent execution",
    },
  ];

  const partners = [
    "PayPal Orders v2",
    "Model Context Protocol",
    "Playwright CDP",
    "APIMatic OpenAPI",
    "Cloudflare Workers",
  ];

  return (
    <section className="py-12 border-y border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Minimalist 4 Metric Counters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 pb-8 border-b border-zinc-200 dark:border-zinc-800">
          {metrics.map((m, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium mb-1">
                {m.label}
              </span>
              <div className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-950 dark:text-white font-mono">
                {m.value}
              </div>
              <div className="text-sm text-zinc-500 mt-1">
                {m.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Ecosystem Partners Row */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-sm font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2 shrink-0">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            <span>Built On Open Standards</span>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-8 gap-y-2 font-mono text-sm sm:text-sm text-zinc-600 dark:text-zinc-400">
            {partners.map((p, idx) => (
              <span key={idx} className="hover:text-black dark:hover:text-white transition-colors">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
