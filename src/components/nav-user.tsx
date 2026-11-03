import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  EllipsisVerticalIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
  ShieldIcon,
  BotIcon,
} from "lucide-react"

export function NavUser({
  user,
  onSignOut,
  onToggleTheme,
  theme,
}: {
  user: {
    name: string
    email: string
    paypalEmail?: string
    role?: "DEVELOPER" | "BUYER"
  }
  onSignOut?: () => void
  onToggleTheme?: () => void
  theme?: "light" | "dark"
}) {
  const { isMobile } = useSidebar()
  const initials = (user.name || user.email || "AG")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="size-8 rounded-md grayscale border border-zinc-200 dark:border-zinc-800">
              <AvatarFallback className="rounded-md font-mono text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight font-mono">
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {user.email}
              </span>
              <span className="truncate text-[10px] text-zinc-500 flex items-center gap-1">
                {user.role === "DEVELOPER" ? (
                  <>
                    <BotIcon className="w-3 h-3 text-muted-foreground" />
                    <span>Developer</span>
                  </>
                ) : (
                  <>
                    <ShieldIcon className="w-3 h-3 text-muted-foreground" />
                    <span>Buyer</span>
                  </>
                )}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4 text-zinc-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-64 font-mono text-sm"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-2 text-left">
                  <Avatar className="size-8 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <AvatarFallback className="rounded-md font-mono text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {user.email}
                    </span>
                    <span className="truncate text-[11px] text-zinc-500">
                      PayPal: {user.paypalEmail || user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onToggleTheme && (
                <DropdownMenuItem onClick={onToggleTheme} className="cursor-pointer">
                  {theme === "dark" ? (
                    <>
                      <SunIcon className="w-4 h-4 mr-2" />
                      <span>Switch to Light Mode</span>
                    </>
                  ) : (
                    <>
                      <MoonIcon className="w-4 h-4 mr-2" />
                      <span>Switch to Dark Mode</span>
                    </>
                  )}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {onSignOut && (
              <DropdownMenuItem
                onClick={onSignOut}
                className="text-rose-600 dark:text-rose-400 cursor-pointer"
              >
                <LogOutIcon className="w-4 h-4 mr-2" />
                <span>Sign out</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
