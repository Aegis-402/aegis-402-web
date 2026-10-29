
export function Footer() {
  const sections = [
    {
      title: "PLATFORM",
      links: [
        { label: "Zero-Leak Canvas", href: "#canvas-engine" },
        { label: "PayPal Orders v2", href: "#escrow-lifecycle" },
        { label: "Playwright CDP Screencast", href: "#canvas-engine" },
        { label: "x402 Settlement Gateway", href: "#marketplace" },
      ],
    },
    {
      title: "DEVELOPERS",
      links: [
        { label: "Model Context Protocol (MCP)", href: "#agent-mcp" },
        { label: "Claude & Cursor Stdio Server", href: "#agent-mcp" },
        { label: "APIMatic OpenAPI Specs", href: "#agent-mcp" },
        { label: "Hono Cloudflare Workers API", href: "/api/bounties" },
      ],
    },
    {
      title: "ESCROW PROTOCOL",
      links: [
        { label: "Intent: 'AUTHORIZE' Holds", href: "#escrow-lifecycle" },
        { label: "Conditional CAPTURE", href: "#escrow-lifecycle" },
        { label: "Instant VOID Refunds", href: "#escrow-lifecycle" },
        { label: "Fair Exchange Invariant", href: "#canvas-engine" },
      ],
    },
    {
      title: "HACKATHON",
      links: [
        { label: "Devpost PayPal AI Hackathon", href: "https://paypalaihackathon.devpost.com" },
        { label: "Zero-Leak Referee Daemon", href: "#canvas-engine" },
        { label: "Active Escrow Bounties", href: "#marketplace" },
        { label: "Autonomous Worker Skill", href: "#agent-mcp" },
      ],
    },
  ];

  return (
    <footer className="py-14 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] text-xs text-zinc-500 font-sans transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {sections.map((sec, i) => (
            <div key={i} className="space-y-3">
              <span className="font-mono text-[11px] font-bold text-zinc-950 dark:text-zinc-200 tracking-wider">
                {sec.title}
              </span>
              <ul className="space-y-2">
                {sec.links.map((link, j) => (
                  <li key={j}>
                    <a
                      href={link.href}
                      className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px]">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 flex items-center justify-center">
              <img src="/aegis-402-logo-black.svg" alt="Aegis-402" className="w-4 h-4 dark:hidden" />
              <img src="/aegis-402-logo-white.svg" alt="Aegis-402" className="w-4 h-4 hidden dark:block" />
            </div>
            <span className="font-bold text-zinc-950 dark:text-white">AEGIS-402</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>Autonomous Escrow Protocol</span>
          </div>

          <div className="text-zinc-400">
            © 2026 Aegis-402. Built for Devpost PayPal AI Hackathon.
          </div>
        </div>
      </div>
    </footer>
  );
}
