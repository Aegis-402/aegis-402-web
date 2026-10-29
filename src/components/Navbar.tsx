import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sun, Moon, Plus, Bot } from "lucide-react";
import type { UserSession } from "./AuthScreen";

interface NavbarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenPostBounty: () => void;
  user?: UserSession | null;
  onOpenAuth?: () => void;
  onOpenDashboard?: () => void;
  onNavigateHome?: () => void;
}

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Navbar({
  theme,
  onToggleTheme,
  onOpenPostBounty,
  user,
  onOpenAuth,
  onOpenDashboard,
  onNavigateHome,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Marketplace", href: "#marketplace" },
    { name: "Zero-Leak Canvas", href: "#canvas-engine" },
    { name: "Protocol & Code", href: "#protocol" },
  ];

  return (
    <div
      className="sticky top-0 z-50 transition-all duration-200"
      style={{
        paddingTop: scrolled ? "10px" : "18px",
        paddingBottom: scrolled ? "10px" : "18px",
        pointerEvents: "none",
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="mx-auto transition-all duration-200 pointer-events-auto"
        style={{
          maxWidth: scrolled ? "1060px" : "1180px",
          margin: "0 auto",
          background: scrolled ? "color-mix(in srgb, var(--bg) 92%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          border: scrolled ? "1px solid var(--surface-border)" : "1px solid transparent",
          borderRadius: scrolled ? "6px" : "0",
          padding: scrolled ? "10px 20px" : "10px 16px",
          boxShadow: scrolled ? "0 4px 20px rgba(0, 0, 0, 0.05)" : "none",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 group cursor-pointer text-left bg-transparent border-0 p-0"
          >
            <div className="w-7 h-7 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
              <img src="/aegis-402-logo-black.svg" alt="Aegis-402" className="w-6 h-6 dark:hidden" />
              <img src="/aegis-402-logo-white.svg" alt="Aegis-402" className="w-6 h-6 hidden dark:block" />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[13px] tracking-tight text-zinc-950 dark:text-white font-medium">
              <span>AEGIS</span>
              <span className="text-[10px] px-1 py-0.2 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                402
              </span>
            </div>
          </button>

          {/* Minimal Text Links */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-zinc-600 dark:text-zinc-400">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={() => {
                  if (onNavigateHome) onNavigateHome();
                }}
                className="hover:text-black dark:hover:text-white transition-colors duration-150"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
              aria-label="Toggle color theme"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Auth / Dashboard Action */}
            {user ? (
              <button
                onClick={onOpenDashboard}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-[12px] font-mono text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-zinc-500" />
                <span>Dashboard</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-[12px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                Sign In
              </button>
            )}

            {/* Post Bounty Button */}
            <button
              onClick={onOpenPostBounty}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-[12px] font-medium tracking-tight active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3 h-3" />
              <span>Post Bounty</span>
            </button>
          </div>
        </div>
      </motion.header>
    </div>
  );
}
