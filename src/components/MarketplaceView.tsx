import * as React from "react"
import {
  Search,
  Lock,
  Bot,
  CheckCircle2,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Bounty } from "../types"

interface MarketplaceViewProps {
  bounties: Bounty[]
  onClaimBounty: (bountyId: string) => void
  onOpenReviewer: (bounty: Bounty) => void
}

type SortOption = "REWARD_DESC" | "REWARD_ASC" | "TESTS_DESC" | "NEWEST"

export function MarketplaceView({
  bounties,
  onClaimBounty,
}: MarketplaceViewProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  // Marketplace only displays claimable open inventory, with optional settled archive
  const [activeTab, setActiveTab] = React.useState<"OPEN" | "SETTLED">("OPEN")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL")
  const [sortBy, setSortBy] = React.useState<SortOption>("REWARD_DESC")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")

  // Dynamic list of unique categories
  const categories = React.useMemo(() => {
    const set = new Set<string>()
    bounties.forEach((b) => {
      if (b.category) set.add(b.category)
    })
    return Array.from(set)
  }, [bounties])

  // Aggregate stats strictly for marketplace scope
  const openBounties = React.useMemo(() => {
    return bounties.filter((b) => b.status === "OPEN_FOR_CLAIM")
  }, [bounties])

  const settledBounties = React.useMemo(() => {
    return bounties.filter((b) => b.status === "SETTLED")
  }, [bounties])

  const totalOpenEscrow = React.useMemo(() => {
    return openBounties.reduce((sum, b) => sum + b.escrowAmount, 0)
  }, [openBounties])

  // Filtered and sorted bounties for active tab
  const filteredBounties = React.useMemo(() => {
    const pool = activeTab === "OPEN" ? openBounties : settledBounties

    return pool
      .filter((b) => {
        // Category filter
        if (categoryFilter !== "ALL" && b.category !== categoryFilter) {
          return false
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchTitle = b.title.toLowerCase().includes(q)
          const matchDesc = b.description.toLowerCase().includes(q)
          const matchCategory = b.category.toLowerCase().includes(q)
          const matchId = b.id.toLowerCase().includes(q)
          if (!matchTitle && !matchDesc && !matchCategory && !matchId) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "REWARD_DESC":
            return b.escrowAmount - a.escrowAmount
          case "REWARD_ASC":
            return a.escrowAmount - b.escrowAmount
          case "TESTS_DESC": {
            const ratioB = b.testsTotal > 0 ? b.testsPassed / b.testsTotal : 0
            const ratioA = a.testsTotal > 0 ? a.testsPassed / a.testsTotal : 0
            return ratioB - ratioA
          }
          case "NEWEST":
          default:
            return b.id.localeCompare(a.id)
        }
      })
  }, [activeTab, openBounties, settledBounties, categoryFilter, searchQuery, sortBy])

  const stages = ["SCAFFOLDING", "CORE_LOGIC", "TESTING", "FINAL_POLISH"]

  return (
    <div className="space-y-5 px-4 lg:px-6">
      {/* Marketplace Header & High-Level Metrics Strip */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono text-xl font-semibold tracking-tight text-foreground">
            Marketplace
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            Browse and claim autonomous agent tasks funded by PayPal Orders v2 escrow.
          </p>
        </div>

        {/* High-signal horizontal stat chips (No duplicate buttons) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 font-mono text-sm">
            <span className="text-muted-foreground">Available Escrow:</span>
            <span className="font-semibold text-foreground">
              ${totalOpenEscrow.toFixed(2)} USD
            </span>
          </div>

          <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 font-mono text-sm">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">Open Tasks:</span>
            <span className="font-semibold text-foreground">{openBounties.length}</span>
          </div>

          <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 font-mono text-sm">
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span className="text-muted-foreground">Settled Archive:</span>
            <span className="font-semibold text-foreground">{settledBounties.length}</span>
          </div>
        </div>
      </div>

      {/* Search, Filter, and View Controls (Pixel-aligned uniform h-8 toolbar) */}
      <div className="space-y-3">
        {/* Row 1: Search & Dropdowns & View Switcher */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search Box (Exact h-8) */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by title, description, or stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-7 font-mono text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Category Filter (Exact h-8) */}
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm font-mono">
              <Filter className="size-3 text-muted-foreground shrink-0" />
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "ALL")}>
                <SelectTrigger className="h-full border-0 bg-transparent px-0 text-foreground shadow-none focus:ring-0 [&_svg]:size-3">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Dropdown (Exact h-8) */}
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm font-mono">
              <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
              <Select value={sortBy} onValueChange={(v) => setSortBy((v as SortOption) ?? "REWARD_DESC")}>
                <SelectTrigger className="h-full border-0 bg-transparent px-0 text-foreground shadow-none focus:ring-0 [&_svg]:size-3">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REWARD_DESC">Reward: High to Low</SelectItem>
                  <SelectItem value="REWARD_ASC">Reward: Low to High</SelectItem>
                  <SelectItem value="TESTS_DESC">Tests: Most Passing</SelectItem>
                  <SelectItem value="NEWEST">Latest ID</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid vs List View Mode (Exact h-8) */}
            <div className="inline-flex h-8 items-center rounded-md border border-input bg-muted/40 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`flex h-6.5 w-6.5 items-center justify-center rounded cursor-pointer transition-colors ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="List View"
                className={`flex h-6.5 w-6.5 items-center justify-center rounded cursor-pointer transition-colors ${
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Status Inventory Tabs (Strictly Open vs Settled Archive) */}
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-3">
          <button
            onClick={() => setActiveTab("OPEN")}
            className={`flex h-7 items-center gap-1.5 px-3 rounded-md font-mono text-sm cursor-pointer transition-colors ${
              activeTab === "OPEN"
                ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-medium"
                : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Open Bounties</span>
            <span
              className={`text-[10px] tabular-nums ${
                activeTab === "OPEN"
                  ? "text-zinc-300 dark:text-zinc-600"
                  : "text-muted-foreground"
              }`}
            >
              ({openBounties.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab("SETTLED")}
            className={`flex h-7 items-center gap-1.5 px-3 rounded-md font-mono text-sm cursor-pointer transition-colors ${
              activeTab === "SETTLED"
                ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-medium"
                : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span>Settled Payouts</span>
            <span
              className={`text-[10px] tabular-nums ${
                activeTab === "SETTLED"
                  ? "text-zinc-300 dark:text-zinc-600"
                  : "text-muted-foreground"
              }`}
            >
              ({settledBounties.length})
            </span>
          </button>

          {(categoryFilter !== "ALL" || searchQuery.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCategoryFilter("ALL")
                setSearchQuery("")
              }}
              className="text-sm font-mono text-muted-foreground hover:text-foreground h-7 px-2 cursor-pointer ml-auto"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Content: Bounty Grid or List */}
      {filteredBounties.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Bot className="size-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-mono text-sm font-medium text-foreground">
            No bounties match your filters
          </h3>
          <p className="mt-1 font-mono text-sm text-muted-foreground max-w-sm mx-auto">
            {activeTab === "OPEN"
              ? "There are currently no open bounties matching your search or category."
              : "No settled bounties match your criteria."}
          </p>
          {(categoryFilter !== "ALL" || searchQuery.trim()) && (
            <div className="mt-4 flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategoryFilter("ALL")
                  setSearchQuery("")
                }}
                className="font-mono text-sm cursor-pointer"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBounties.map((bounty) => {
            const isSettled = bounty.status === "SETTLED"

            const currentStageIndex =
              stages.indexOf(bounty.currentStage) !== -1
                ? stages.indexOf(bounty.currentStage)
                : 0

            const testRatio =
              bounty.testsTotal > 0
                ? Math.round((bounty.testsPassed / bounty.testsTotal) * 100)
                : 0

            return (
              <div
                key={bounty.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all hover:border-zinc-400 dark:hover:border-zinc-700 shadow-xs"
              >
                <div>
                  {/* Category & Status Row */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {bounty.category}
                    </span>

                    {isSettled ? (
                      <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        <span>Settled</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Claimable</span>
                      </span>
                    )}
                  </div>

                  {/* Bounty Title */}
                  <h3 className="font-mono text-sm font-semibold tracking-tight text-foreground line-clamp-2">
                    {bounty.title}
                  </h3>

                  {/* Bounty Description */}
                  <p className="mt-1.5 font-mono text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {bounty.description}
                  </p>

                  {/* Milestone Stage Tracker */}
                  <div className="mt-4 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground mb-1.5">
                      <span>
                        Stage:{" "}
                        <span className="text-foreground font-medium">
                          {bounty.currentStage}
                        </span>
                      </span>
                      <span className="tabular-nums">{testRatio}%</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 h-1 bg-muted rounded-xs">
                      {stages.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-full rounded-xs transition-colors ${
                            idx <= currentStageIndex
                              ? isSettled
                                ? "bg-muted-foreground"
                                : "bg-foreground"
                              : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer: Escrow & Direct Claim CTA */}
                <div className="mt-4 pt-3 border-t border-border/60">
                  <div className="flex items-center justify-between font-mono text-sm mb-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>Tests:</span>
                      <span
                        className={
                          bounty.testsPassed === bounty.testsTotal && bounty.testsTotal > 0
                            ? "text-emerald-500 font-medium"
                            : "text-foreground font-medium"
                        }
                      >
                        {bounty.testsPassed}/{bounty.testsTotal}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                        <Lock className="size-2.5 text-[#0070ba]" />
                        <span>PayPal Escrow</span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        ${bounty.escrowAmount.toFixed(2)} {bounty.currency}
                      </span>
                    </div>
                  </div>

                  {/* Direct Action */}
                  {isSettled ? (
                    <div className="w-full py-1.5 rounded-md bg-muted text-muted-foreground text-center font-mono text-sm">
                      Settled via PayPal Capture
                    </div>
                  ) : (
                    <Button
                      onClick={() => onClaimBounty(bounty.id)}
                      className="w-full font-mono text-sm cursor-pointer"
                    >
                      <Bot className="size-3.5" />
                      <span>Claim 30m Lease (MCP)</span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-left font-mono text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Bounty Title</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Stage / Tests</th>
                <th className="py-2.5 px-4">Escrow Locked</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBounties.map((b) => {
                const isSettled = b.status === "SETTLED"

                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      {isSettled ? (
                        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                          Settled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                          Claimable
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground max-w-sm truncate">
                        {b.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {b.description}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{b.category}</td>
                    <td className="py-3 px-4">
                      <div className="text-foreground">{b.currentStage}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {b.testsPassed}/{b.testsTotal} tests passing
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      ${b.escrowAmount.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isSettled ? (
                        <span className="text-[11px] text-muted-foreground">Captured</span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onClaimBounty(b.id)}
                          className="font-mono text-sm cursor-pointer h-7"
                        >
                          <Bot className="size-3" />
                          <span>Claim Lease</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
