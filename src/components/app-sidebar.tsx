import * as React from "react"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
  Bot,
  Clock,
  ExternalLink,
  Shield,
  Lock,
  ArrowLeft,
  DollarSign,
  Play,
} from "lucide-react"
import type { UserSession } from "./AuthScreen"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserSession
  activeRole: "DEVELOPER" | "BUYER"
  activeTab: string
  onSelectTab: (tab: string) => void
  onNavigateToMarketplace?: () => void
  onSignOut?: () => void
  onToggleTheme?: () => void
  theme: "light" | "dark"
}

export function AppSidebar({
  user,
  activeRole,
  activeTab,
  onSelectTab,
  onNavigateToMarketplace,
  onSignOut,
  onToggleTheme,
  theme,
  ...props
}: AppSidebarProps) {
  const developerMenuItems = [
    {
      id: "fleet",
      title: "Agent Fleet & Keys",
      icon: <Bot className="w-4 h-4" />,
    },
    {
      id: "leases",
      title: "Active 15m Leases",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      id: "marketplace",
      title: "Claim Bounties",
      icon: <Play className="w-4 h-4" />,
    },
    {
      id: "payouts",
      title: "PayPal Disbursements",
      icon: <DollarSign className="w-4 h-4 text-emerald-500" />,
    },
  ]

  const buyerMenuItems = [
    {
      id: "review-queue",
      title: "Review Queue (CDP)",
      icon: <ExternalLink className="w-4 h-4 text-emerald-500" />,
    },
    {
      id: "bounties",
      title: "All Escrow Bounties",
      icon: <Shield className="w-4 h-4" />,
    },
    {
      id: "escrow",
      title: "PayPal Authorizations",
      icon: <Lock className="w-4 h-4 text-[#0070ba]" />,
    },
  ]

  const items = activeRole === "DEVELOPER" ? developerMenuItems : buyerMenuItems

  return (
    <Sidebar collapsible="offcanvas" {...props} className="border-r border-zinc-200 dark:border-zinc-800">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-zinc-200 dark:border-zinc-800 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <div
              onClick={onNavigateToMarketplace}
              className="flex items-center gap-2.5 p-1.5 rounded-md cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <img src="/aegis-402-logo-black.svg" alt="Aegis-402" className="w-5 h-5 dark:hidden" />
                <img src="/aegis-402-logo-white.svg" alt="Aegis-402" className="w-5 h-5 hidden dark:block" />
              </div>
              <div className="flex flex-col font-mono leading-none">
                <span className="text-xs font-semibold tracking-tight text-zinc-950 dark:text-white">
                  AEGIS-402
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  Zero-Trust Escrow
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation Groups */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 px-3">
            {activeRole === "DEVELOPER" ? "Developer Navigation" : "Buyer Escrow Tools"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectTab(item.id)}
                    isActive={activeTab === item.id}
                    className={`font-mono text-xs cursor-pointer ${
                      activeTab === item.id
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Secondary Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 px-3">
            External
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onNavigateToMarketplace}
                  className="font-mono text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Public Marketplace</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Session Footer */}
      <SidebarFooter className="border-t border-zinc-200 dark:border-zinc-800 p-2">
        <NavUser
          user={{
            name: user.name || user.email.split("@")[0],
            email: user.email,
            paypalEmail: user.paypalEmail,
            role: activeRole,
          }}
          onSignOut={onSignOut}
          onToggleTheme={onToggleTheme}
          theme={theme}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
