import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Sun, Moon } from "lucide-react"

interface SiteHeaderProps {
  activeRole: "DEVELOPER" | "BUYER"
  onToggleRole: (role: "DEVELOPER" | "BUYER") => void
  onOpenPostBounty?: () => void
  onNavigateToMarketplace?: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export function SiteHeader({
  activeRole,
  onToggleRole,
  onOpenPostBounty,
  onNavigateToMarketplace,
  theme,
  onToggleTheme,
}: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      {/* Left: Sidebar trigger & Breadcrumb */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">AEGIS-402</span>
          <span>/</span>
          <span>{activeRole === "DEVELOPER" ? "Developer Hub" : "Buyer Console"}</span>
        </div>
      </div>

      {/* Right: Role Switcher & Quick Actions */}
      <div className="flex items-center gap-2.5">
        {/* Seamless Role Switcher */}
        <div className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
          <button
            onClick={() => onToggleRole("DEVELOPER")}
            className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              activeRole === "DEVELOPER"
                ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Developer Hub
          </button>
          <button
            onClick={() => onToggleRole("BUYER")}
            className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              activeRole === "BUYER"
                ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Buyer Console
          </button>
        </div>

        {activeRole === "BUYER" && onOpenPostBounty && (
          <Button size="sm" onClick={onOpenPostBounty} className="hidden sm:inline-flex">
            <Plus />
            <span>Post Bounty</span>
          </Button>
        )}

        {onNavigateToMarketplace && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToMarketplace}
            className="hidden md:inline-flex text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft />
            <span>Marketplace</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  )
}
