
export function Footer() {
  return (
    <footer className="py-8 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] text-sm text-zinc-500 font-sans transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px]">
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
