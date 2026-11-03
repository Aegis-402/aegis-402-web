import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Lock, Clock, ExternalLink, CheckCircle2 } from "lucide-react"
import type { Bounty } from "../types"

interface SectionCardsProps {
  bounties: Bounty[]
}

export function SectionCards({ bounties }: SectionCardsProps) {
  const readyBounties = bounties.filter((b) => b.status === "READY_FOR_REVIEW")
  const inProgressBounties = bounties.filter((b) => b.status === "IN_PROGRESS")

  const totalLockedEscrow = bounties
    .filter((b) => b.status !== "REFUNDED" && b.status !== "SETTLED")
    .reduce((sum, b) => sum + b.escrowAmount, 0)

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1: Escrow Locked */}
      <Card>
        <CardHeader>
          <CardDescription>Escrow Locked</CardDescription>
          <CardTitle className="text-2xl font-mono font-medium tracking-tight">
            ${totalLockedEscrow.toFixed(2)} USD
          </CardTitle>
          <CardAction>
            <Badge variant="paypal">
              <Lock className="w-3 h-3" />
              <span>PayPal Orders v2</span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm font-mono text-zinc-500">
          <div>Authorized two-phase holds</div>
        </CardFooter>
      </Card>

      {/* Card 2: Active 30m Leases */}
      <Card>
        <CardHeader>
          <CardDescription>Active 30m Leases</CardDescription>
          <CardTitle className="text-2xl font-mono font-medium tracking-tight">
            {inProgressBounties.length + readyBounties.length} Running
          </CardTitle>
          <CardAction>
            <Badge variant="amber">
              <Clock className="w-3 h-3" />
              <span>Anti-Duplicate Lock</span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm font-mono text-zinc-500">
          <div>Prevents redundant agent token burn</div>
        </CardFooter>
      </Card>

      {/* Card 3: Review Queue */}
      <Card>
        <CardHeader>
          <CardDescription>Review Queue (CDP)</CardDescription>
          <CardTitle className="text-2xl font-mono font-medium tracking-tight text-emerald-500">
            {readyBounties.length} Deliverable
          </CardTitle>
          <CardAction>
            <Badge variant="emerald">
              <ExternalLink className="w-3 h-3" />
              <span>Zero-Leak Stream</span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm font-mono text-zinc-500">
          <div>Opaque HTML5 canvas (0 DOM leaks)</div>
        </CardFooter>
      </Card>

      {/* Card 4: Automated Verification */}
      <Card>
        <CardHeader>
          <CardDescription>Automated Verification</CardDescription>
          <CardTitle className="text-2xl font-mono font-medium tracking-tight">
            100% Passed
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Zero-Leak CDP</span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm font-mono text-zinc-500">
          <div>Playwright headless container</div>
        </CardFooter>
      </Card>
    </div>
  )
}
