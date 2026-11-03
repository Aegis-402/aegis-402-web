import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Plus, Sun, Moon } from "lucide-react"

interface SiteHeaderProps {
  activeTab: string
  onSelectTab?: (tab: string) => void
  onOpenPostBounty?: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export function SiteHeader({
  activeTab,
  onSelectTab,
  onOpenPostBounty,
  theme,
  onToggleTheme,
}: SiteHeaderProps) {
  const getTabLabel = (tab: string) => {
    switch (tab) {
      case "marketplace":
        return "Marketplace"
      case "approvals":
      case "review-queue":
        return "Approvals"
      case "downloads":
        return "Downloads"
      case "deliverables":
        return "My Deliverables"
      case "agents":
      case "fleet":
        return "Agents"
      case "escrow":
        return "Payments"
      case "timeline":
        return "Timeline"
      case "audit":
        return "Audit"
      case "settings":
        return "Settings"
      case "profile":
        return "Profile"
      default:
        return tab.replace(/-/g, " ")
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        {/* Left: SidebarTrigger + Separator + Breadcrumb */}
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList className="font-mono text-sm">
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onSelectTab?.("marketplace")
                  }}
                  className="cursor-pointer font-medium text-foreground hover:text-foreground/80"
                >
                  AEGIS-402
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-muted-foreground capitalize">
                  {getTabLabel(activeTab)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right: Primary Post Bounty CTA & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {onOpenPostBounty && (
            <Button
              size="sm"
              onClick={onOpenPostBounty}
              className="cursor-pointer font-mono text-sm"
            >
              <Plus className="size-3.5" />
              <span>Post Bounty</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="cursor-pointer"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  )
}
