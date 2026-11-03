import { useEffect, useMemo } from "react";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import { DomHelper } from "@bryntum/scheduler";
import { CalendarClock } from "lucide-react";
import type { Bounty, BountyStatus } from "../types";

interface LeaseTimelineProps {
  bounties: Bounty[];
  theme: "light" | "dark";
  onSelectBounty?: (bounty: Bounty) => void;
}

const LEASE_MS = 30 * 60 * 1000;

function eventColorFor(status: BountyStatus): string {
  switch (status) {
    case "IN_PROGRESS":
    case "PROVISIONING":
      return "orange";
    case "READY_FOR_REVIEW":
      return "teal";
    case "SETTLED":
      return "green";
    case "REFUNDED":
      return "gray";
    case "OPEN_FOR_CLAIM":
    default:
      return "gray";
  }
}

function eventWindowFor(b: Bounty): { start: Date; end: Date } | null {
  const now = Date.now();
  switch (b.status) {
    case "OPEN_FOR_CLAIM":
      return null;
    case "IN_PROGRESS": {
      const end = b.leaseExpiresAt ?? now;
      return { start: new Date(end - LEASE_MS), end: new Date(end) };
    }
    case "PROVISIONING": {
      const start = b.provisionStartedAt ?? now - LEASE_MS;
      return { start: new Date(start), end: new Date(now) };
    }
    case "READY_FOR_REVIEW": {
      const end = b.verificationSummary?.completedAt ?? now;
      return { start: new Date(end - 60 * 60 * 1000), end: new Date(end) };
    }
    case "SETTLED": {
      const end = b.settledAt ?? now;
      return { start: new Date(end - 60 * 60 * 1000), end: new Date(end) };
    }
    case "REFUNDED": {
      const end = b.settledAt ?? now;
      return { start: new Date(end - 60 * 60 * 1000), end: new Date(end) };
    }
    default:
      return null;
  }
}

function eventNameFor(b: Bounty): string {
  if (b.status === "OPEN_FOR_CLAIM") return "open — no lease";
  const who = b.workerAgentId || "agent";
  if (b.status === "IN_PROGRESS") return `${who} · ${b.currentStage || "working"}`;
  return `${who} · ${b.status}`;
}

export function LeaseTimeline({ bounties, theme, onSelectBounty }: LeaseTimelineProps) {
  // Theme switching the Bryntum-supported way: the theme <link> lives in
  // index.html (with data-bryntum-theme) and DomHelper.setTheme swaps the
  // theme filename in place. Idempotent — safe under StrictMode remounts.
  useEffect(() => {
    void DomHelper.setTheme(theme === "dark" ? "stockholm-dark" : "stockholm-light");
  }, [theme]);

  const { resources, events } = useMemo(() => {
    const resources = bounties.map((b) => ({
      id: b.id,
      name: b.title,
      escrow: b.escrowAmount,
      status: b.status,
    }));
    const events = bounties.flatMap((b) => {
      const win = eventWindowFor(b);
      if (!win) return [];
      return [
        {
          id: `evt-${b.id}`,
          resourceId: b.id,
          name: eventNameFor(b),
          startDate: win.start,
          endDate: win.end,
          eventColor: eventColorFor(b.status),
        },
      ];
    });
    return { resources, events };
  }, [bounties]);

  const { dayStart, dayEnd } = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return { dayStart: d, dayEnd: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
  }, []);

  const activeCount = bounties.filter((b) => b.status === "IN_PROGRESS").length;
  const openCount = bounties.filter((b) => b.status === "OPEN_FOR_CLAIM").length;

  return (
    <div className="px-4 lg:px-6 space-y-4">
      <div className="pb-3 border-b border-border">
        <h2 className="text-base font-medium text-foreground tracking-tight flex items-center gap-2">
          <CalendarClock className="size-4" />
          <span>Lease Timeline</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {activeCount} active {activeCount === 1 ? "lease" : "leases"} · {openCount} open{" "}
          {openCount === 1 ? "bounty" : "bounties"} · 30-minute windows · PayPal lock per bounty.
          Powered by Bryntum Scheduler (trial).
        </p>
      </div>

      {bounties.length === 0 ? (
        <div className="p-8 text-center rounded-md border border-dashed border-border bg-muted/20">
          <CalendarClock className="size-8 text-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No bounties to schedule</p>
          <p className="text-sm text-muted-foreground mt-1">
            Post a bounty and its lease will appear here as a time bar.
          </p>
        </div>
      ) : (
        <div
          className="rounded-md border border-border overflow-hidden bg-card"
          data-theme={theme}
        >
          <BryntumScheduler
            startDate={dayStart}
            endDate={dayEnd}
            viewPreset="hourAndDay"
            rowHeight={44}
            barMargin={6}
            autoHeight={true}
            readOnly={true}
            resources={resources}
            events={events}
            columns={[
              { text: "Bounty", field: "name", width: 240 },
              {
                text: "Escrow",
                field: "escrow",
                width: 90,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                renderer: ({ value }: any) => `$${Number(value ?? 0).toFixed(2)}`,
              },
              { text: "Status", field: "status", width: 150 },
            ]}
            onEventClick={({ eventRecord }: { eventRecord: { id: string } }) => {
              const id = String(eventRecord.id).replace(/^evt-/, "");
              const bounty = bounties.find((b) => b.id === id);
              if (bounty) onSelectBounty?.(bounty);
            }}
          />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Read-only for v1: bars move when claims, checkpoints, approvals, and PayPal
        capture/void events land. Open rows have no bar yet — claim one from the Marketplace.
      </p>
    </div>
  );
}
