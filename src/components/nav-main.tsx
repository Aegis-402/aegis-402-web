import * as React from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavMainItem {
  id: string
  title: string
  url?: string
  icon?: React.ReactNode
  badge?: string | number
  badgeVariant?: "default" | "outline" | "emerald" | "amber" | "destructive" | "paypal"
}

interface NavMainProps {
  items: NavMainItem[]
  activeTab?: string
  onSelectTab?: (tab: string) => void
}

export function NavMain({
  items,
  activeTab,
  onSelectTab,
}: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = activeTab === item.id
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  onClick={() => onSelectTab?.(item.id)}
                  className={`font-mono text-sm cursor-pointer transition-colors ${
                    isActive
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  {item.badge !== undefined && item.badge !== null && (
                    <span className="ml-auto text-[11px] font-mono text-muted-foreground/80 tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
