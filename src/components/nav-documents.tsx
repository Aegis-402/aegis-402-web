import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { MoreHorizontalIcon, FileTextIcon, ExternalLinkIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"

export interface NavDocumentItem {
  name: string
  url?: string
  description?: string
  icon: React.ReactNode
}

export function NavDocuments({
  items,
  title = "Protocol Attestations",
}: {
  items: NavDocumentItem[]
  title?: string
}) {
  const { isMobile } = useSidebar()

  const handleCopyLink = (item: NavDocumentItem) => {
    navigator.clipboard.writeText(item.url || window.location.href)
    toast.success(`Copied link for ${item.name}`)
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2">
        {title}
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              onClick={() => {
                if (item.url) {
                  window.open(item.url, "_blank")
                } else {
                  toast.info(item.description || item.name)
                }
              }}
              className="font-mono text-sm cursor-pointer"
            >
              {item.icon}
              <span className="truncate">{item.name}</span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuAction
                    showOnHover
                    className="aria-expanded:bg-muted"
                  />
                }
              >
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">More options</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-36 font-mono text-sm"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem
                  onClick={() => {
                    if (item.url) {
                      window.open(item.url, "_blank")
                    } else {
                      toast.info(item.description || item.name)
                    }
                  }}
                  className="cursor-pointer"
                >
                  <ExternalLinkIcon className="size-3.5 mr-2" />
                  <span>View Spec</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleCopyLink(item)}
                  className="cursor-pointer"
                >
                  <CopyIcon className="size-3.5 mr-2" />
                  <span>Copy Link</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => toast.info(`${item.name} verified on Midnight Testnet`)}
                  className="cursor-pointer"
                >
                  <FileTextIcon className="size-3.5 mr-2" />
                  <span>Attestation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
