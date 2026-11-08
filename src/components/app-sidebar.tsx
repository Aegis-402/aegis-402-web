import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavMain, type NavMainItem } from "@/components/nav-main";
import {
  NavSecondary,
  type NavSecondaryItem,
} from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  Download,
  FileCode,
  Lock,
  Layers,
  LifeBuoy,
  Settings,
  User,
} from "lucide-react";
import { toast } from "sonner";
import type { UserSession } from "./AuthScreen";
import type { Bounty } from "../types";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserSession;
  bounties: Bounty[];
  agentCount: number;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSignOut?: () => void;
  onToggleTheme?: () => void;
  theme: "light" | "dark";
}

export function AppSidebar({
  user,
  bounties,
  agentCount,
  activeTab,
  onSelectTab,
  onSignOut,
  onToggleTheme,
  theme,
  ...props
}: AppSidebarProps) {
  const isBuyer = user?.role === "BUYER";
  const openBountiesCount = bounties.filter(
    (b) => b.status === "OPEN_FOR_CLAIM"
  ).length;
  const readyForReviewCount = bounties.filter(
    (b) => b.status === "READY_FOR_REVIEW"
  ).length;
  const activeDeliverablesCount = bounties.filter(
    (b) => b.status === "IN_PROGRESS" || b.status === "READY_FOR_REVIEW"
  ).length;

  // NavMain Items: Tailored to Buyer vs Developer role
  const navMainItems: NavMainItem[] = isBuyer
    ? [
        {
          id: "marketplace",
          title: "Marketplace",
          icon: <Layers className="size-4 shrink-0" />,
          badge: openBountiesCount > 0 ? openBountiesCount : undefined,
          badgeVariant: "outline",
        },
        {
          id: "approvals",
          title: "Approvals",
          icon: <CheckCircle2 className="size-4 shrink-0" />,
          badge: readyForReviewCount > 0 ? readyForReviewCount : undefined,
          badgeVariant: "outline",
        },
        {
          id: "downloads",
          title: "Downloads",
          icon: <Download className="size-4 shrink-0" />,
        },
        {
          id: "escrow",
          title: "Payments",
          icon: <Lock className="size-4 shrink-0" />,
        },
        {
          id: "timeline",
          title: "Timeline",
          icon: <CalendarClock className="size-4 shrink-0" />,
        },
        {
          id: "audit",
          title: "Audit",
          icon: <BarChart3 className="size-4 shrink-0" />,
        },
      ]
    : [
        {
          id: "marketplace",
          title: "Marketplace",
          icon: <Layers className="size-4 shrink-0" />,
          badge: openBountiesCount > 0 ? openBountiesCount : undefined,
          badgeVariant: "outline",
        },
        {
          id: "deliverables",
          title: "Deliverables",
          icon: <FileCode className="size-4 shrink-0" />,
          badge:
            activeDeliverablesCount > 0 ? activeDeliverablesCount : undefined,
          badgeVariant: "outline",
        },
        {
          id: "agents",
          title: "Agents",
          icon: <Bot className="size-4 shrink-0" />,
          badge: agentCount > 0 ? agentCount : undefined,
          badgeVariant: "outline",
        },
        {
          id: "timeline",
          title: "Timeline",
          icon: <CalendarClock className="size-4 shrink-0" />,
        },
        {
          id: "audit",
          title: "Audit",
          icon: <BarChart3 className="size-4 shrink-0" />,
        },
      ];

  // Secondary navigation: documentation, settings, profile
  const secondaryItems: NavSecondaryItem[] = [
    {
      title: "Documentation",
      icon: <LifeBuoy className="size-4 shrink-0" />,
      onClick: () => toast.info("Opening Aegis-402 Developer Documentation"),
    },
    {
      title: "Settings",
      icon: <Settings className="size-4 shrink-0" />,
      onClick: () => onSelectTab("settings"),
    },
    {
      title: "Profile",
      icon: <User className="size-4 shrink-0" />,
      onClick: () => onSelectTab("profile"),
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props} className="border-r-0 bg-sidebar">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => onSelectTab("marketplace")}
              className="cursor-pointer group-data-[collapsible=icon]:p-0"
              tooltip="AEGIS-402 Escrow"
            >
              <div className="flex size-8 items-center justify-center shrink-0">
                <img
                  src="/aegis-402-logo-black.svg"
                  alt="Aegis-402"
                  className="size-6 shrink-0 dark:hidden"
                />
                <img
                  src="/aegis-402-logo-white.svg"
                  alt="Aegis-402"
                  className="size-6 shrink-0 hidden dark:block"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight font-mono">
                <span className="truncate font-semibold tracking-tight text-foreground">
                  AEGIS-402
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  Zero-Trust Escrow
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Sidebar Navigation Content */}
      <SidebarContent>
        <NavMain
          items={navMainItems}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>

      {/* Sidebar Footer with Live User Account Details */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser
          user={{
            name: user.name || user.email.split("@")[0],
            email: user.email,
            paypalEmail: user.paypalEmail,
            role: user.role || "MEMBER",
          }}
          onSignOut={onSignOut}
          onToggleTheme={onToggleTheme}
          theme={theme}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
