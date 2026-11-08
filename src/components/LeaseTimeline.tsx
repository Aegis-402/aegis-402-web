import { useEffect, useMemo, useState } from "react";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import { DomHelper } from "@bryntum/scheduler";
import { CalendarClock, Search } from "lucide-react";
import type { Bounty, BountyStatus } from "../types";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { DEMO_BOUNTIES } from "./demoBounties";

interface LeaseTimelineProps {
  bounties: Bounty[];
  theme: "light" | "dark";
}

const LEASE_MS = 30 * 60 * 1000;
const HALF_HOUR_MS = 30 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
/** Overview renders in batches — 100+ Bryntum rows with autoHeight hangs. */
const PAGE_SIZE = 20;

function eventColorFor(status: BountyStatus): string {
  switch (status) {
    case "IN_PROGRESS":
    case "PROVISIONING":
      return "orange";
    case "READY_FOR_REVIEW":
      return "amber";
    case "SETTLED":
      return "green";
    case "REFUNDED":
      return "gray";
    case "OPEN_FOR_CLAIM":
    default:
      return "gray";
  }
}

/** Short PayPal reference for bar labels — keeps money IDs visible on camera. */
function paypalShort(b: Bounty): string {
  const id = b.payPalCaptureId || b.payPalAuthorizationId || b.payoutBatchId || "";
  if (!id) return "no PP yet";
  return `PP ${id.slice(0, 6)}`;
}

/** Status pill — same fills as the audit verdict pills so both tabs agree. */
function bountyStatusPill(status: BountyStatus): { bg: string; fg: string } {
  switch (status) {
    case "SETTLED":
      return { bg: "#10b981", fg: "#09090b" };
    case "READY_FOR_REVIEW":
      return { bg: "#fb923c", fg: "#09090b" };
    case "IN_PROGRESS":
      return { bg: "#f59e0b", fg: "#09090b" };
    case "PROVISIONING":
      return { bg: "#0070ba", fg: "#fafafa" };
    case "REFUNDED":
      return { bg: "#f43f5e", fg: "#fafafa" };
    case "OPEN_FOR_CLAIM":
    default:
      return { bg: "#27272a", fg: "#fafafa" };
  }
}
function stagePill(stage: string): { bg: string; fg: string } {
  const s = stage.toUpperCase();
  if (/FINAL|POLISH|DONE|SEAL/.test(s)) return { bg: "#10b981", fg: "#09090b" };
  if (/TEST/.test(s)) return { bg: "#f59e0b", fg: "#09090b" };
  if (/CORE|LOGIC|BUILD/.test(s)) return { bg: "#0070ba", fg: "#fafafa" };
  return { bg: "#27272a", fg: "#fafafa" };
}

/** Fit a window to event times: pad each side, cap the span, anchor at latest. */
function fitWindow(
  times: number[],
  padMs: number,
  capMs: number
): { start: Date; end: Date } | null {
  if (times.length === 0) return null;
  let lo = Math.min(...times);
  const hi = Math.max(...times);
  if (hi - lo > capMs) lo = hi - capMs;
  return { start: new Date(lo - padMs), end: new Date(hi + padMs) };
}

function todayWindow(): { start: Date; end: Date } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { start: d, end: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
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

function escrowWindowFor(b: Bounty): { start: Date; end: Date } | null {
  if (b.status === "OPEN_FOR_CLAIM") return null;
  const now = Date.now();
  const start = new Date(
    b.provisionStartedAt ?? b.leaseExpiresAt ?? now - 60 * 60 * 1000
  );
  if (b.leaseExpiresAt && !b.provisionStartedAt) {
    start.setTime(b.leaseExpiresAt - LEASE_MS);
  }
  const end = new Date(
    b.settledAt ?? b.verificationSummary?.completedAt ?? b.leaseExpiresAt ?? now
  );
  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}

function eventNameFor(b: Bounty): string {
  if (b.status === "OPEN_FOR_CLAIM") return "open — no lease";
  const who = b.workerAgentId || "agent";
  if (b.status === "IN_PROGRESS") return `${who} · ${b.currentStage}`;
  return `${who} · ${b.status}`;
}

/** Legend swatch that IS the mark: solid bar, dashed hold, checkpoint tick. */
function LegendMark({ kind }: { kind: "lease" | "escrow" | "checkpoint" }) {
  if (kind === "lease")
    return (
      <span
        aria-hidden
        className="inline-block h-3 w-6 rounded-full bg-zinc-500"
      />
    );
  if (kind === "escrow")
    return (
      <span
        aria-hidden
        className="inline-block h-3 w-6 rounded-full border-2 border-dashed border-[#0070ba]"
      />
    );
  return (
    <span aria-hidden className="inline-block h-3 w-2 rounded-full bg-teal-500" />
  );
}

export function LeaseTimeline({ bounties, theme }: LeaseTimelineProps) {
  const [showDemo, setShowDemo] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // Content signature: the dashboard polls every 10s with fresh array
  // identities. Memo on content so `now`-fallbacks, ranges, and scheduler
  // mounts stay stable between polls.
  const bountySig = JSON.stringify(
    bounties.map((b) =>
      [
        b.id,
        b.title,
        b.status,
        b.workerAgentId ?? "",
        b.escrowAmount,
        b.leaseExpiresAt ?? 0,
        b.provisionStartedAt ?? 0,
        b.settledAt ?? 0,
        b.verificationSummary?.completedAt ?? 0,
        (b.checkpoints ?? []).map((c) => c.timestamp).join(","),
      ].join("|")
    )
  );
  const effectiveBounties = useMemo(
    () => (showDemo ? [...bounties, ...DEMO_BOUNTIES] : bounties),
    // Content-gated on purpose: fresh poll identities must not recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bountySig, showDemo]
  );

  // Reset paging when the dataset changes (demo toggled, bounties arrive).
  // Length-gated so the 10s dashboard poll doesn't yank the scroll.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [showDemo, bounties.length]);

  // Theme switching the Bryntum-supported way: the theme <link> lives in
  // index.html (with data-bryntum-theme) and DomHelper.setTheme swaps the
  // theme filename in place. Idempotent — safe under StrictMode remounts.
  useEffect(() => {
    void DomHelper.setTheme(theme === "dark" ? "stockholm-dark" : "stockholm-light");
  }, [theme]);

  const { resources, events, spanTimes } = useMemo(() => {
    const resources = effectiveBounties.map((b) => ({
      id: b.id,
      name: b.title,
      agent: b.workerAgentId || "unclaimed",
      escrow: b.escrowAmount,
      paypal: paypalShort(b),
      status: b.status,
    }));
    const events = effectiveBounties.flatMap((b) => {
      const win = eventWindowFor(b);
      if (!win) return [];
      const lease = [
        {
          id: `evt-${b.id}`,
          resourceId: b.id,
          name: `${eventNameFor(b)} · ${paypalShort(b)}`,
          startDate: win.start,
          endDate: win.end,
          eventColor: eventColorFor(b.status),
          eventStyle: "rounded" as const,
        },
      ];
      const hold = escrowWindowFor(b);
      if (!hold) return lease;
      return [
        ...lease,
        {
          id: `escrow-${b.id}`,
          resourceId: b.id,
          name: `escrow $${Number(b.escrowAmount ?? 0).toFixed(2)} · ${paypalShort(b)}`,
          startDate: hold.start,
          endDate: hold.end,
          eventColor: "blue",
          eventStyle: "dashed" as const,
        },
      ];
    });
    // Fit on leases + checkpoints only: multi-day escrow holds would
    // otherwise stretch the axis into slivers.
    const spanTimes: number[] = [];
    for (const b of effectiveBounties) {
      const win = eventWindowFor(b);
      if (win) spanTimes.push(win.start.getTime(), win.end.getTime());
      for (const c of b.checkpoints ?? []) spanTimes.push(c.timestamp);
    }
    return { resources, events, spanTimes };
  }, [effectiveBounties]);

  // Fit the overview to the action (last 12h max) — a fixed "today" window
  // hides every bar when the data is older than midnight (local dev, stale
  // leases). Falls back to today when empty.
  const { overviewStart, overviewEnd } = useMemo(() => {
    const fitted = fitWindow(spanTimes, HALF_HOUR_MS, TWELVE_HOURS_MS);
    if (!fitted) {
      const t = todayWindow();
      return { overviewStart: t.start, overviewEnd: t.end };
    }
    return { overviewStart: fitted.start, overviewEnd: fitted.end };
  }, [spanTimes]);

  const visibleResources = useMemo(
    () => resources.slice(0, visibleCount),
    [resources, visibleCount]
  );
  const visibleEvents = useMemo(() => {
    const ids = new Set(visibleResources.map((r) => r.id));
    return events.filter((e) => ids.has(e.resourceId));
  }, [events, visibleResources]);

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return effectiveBounties
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          (b.workerAgentId || "").toLowerCase().includes(q) ||
          b.status.toLowerCase().includes(q.replace(/ /g, "_"))
      )
      .slice(0, 8);
  }, [effectiveBounties, query]);

  // Per-bounty detail: defaults to the first bounty that has a window.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (effectiveBounties.length === 0) return null;
    const found = selectedId
      ? effectiveBounties.find((b) => b.id === selectedId)
      : undefined;
    if (found) return found;
    return (
      effectiveBounties.find((b) => eventWindowFor(b) || escrowWindowFor(b)) ??
      effectiveBounties[0]
    );
  }, [effectiveBounties, selectedId]);

  const detail = useMemo(() => {
    if (!selected) return null;
    const leaseWin = eventWindowFor(selected);
    const holdWin = escrowWindowFor(selected);
    const checkpoints = [...(selected.checkpoints ?? [])].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const detailResources = [
      {
        id: selected.id,
        name: selected.title,
        detail: `${selected.workerAgentId || "unclaimed"} · $${Number(selected.escrowAmount ?? 0).toFixed(2)}`,
      },
      {
        id: `${selected.id}-chk`,
        name: "Checkpoints",
        detail: `${checkpoints.length} recorded`,
      },
    ];
    const detailEvents: Array<{
      id: string;
      resourceId: string;
      name: string;
      startDate: Date;
      endDate: Date;
      eventColor: string;
      eventStyle: "rounded" | "dashed";
    }> = [];
    if (leaseWin) {
      detailEvents.push({
        id: `detail-lease-${selected.id}`,
        resourceId: selected.id,
        name: `${eventNameFor(selected)} · ${paypalShort(selected)}`,
        startDate: leaseWin.start,
        endDate: leaseWin.end,
        eventColor: eventColorFor(selected.status),
        eventStyle: "rounded",
      });
    }
    if (holdWin) {
      detailEvents.push({
        id: `detail-escrow-${selected.id}`,
        resourceId: selected.id,
        name: `escrow $${Number(selected.escrowAmount ?? 0).toFixed(2)} · ${paypalShort(selected)}`,
        startDate: holdWin.start,
        endDate: holdWin.end,
        eventColor: "blue",
        eventStyle: "dashed",
      });
    }
    for (let i = 0; i < checkpoints.length; i++) {
      const c = checkpoints[i];
      detailEvents.push({
        id: `detail-chk-${selected.id}-${i}`,
        resourceId: `${selected.id}-chk`,
        name: `✓ ${c.stage.replace(/_/g, " ")} · ${c.testsPassed}/${c.testsTotal}`,
        startDate: new Date(c.timestamp),
        endDate: new Date(c.timestamp + 2 * 60 * 1000),
        eventColor: "teal",
        eventStyle: "rounded",
      });
    }
    // Fit to the bounty (lease + checkpoints, escrow excluded) — never more
    // than 5h of empty context on either side.
    const times: number[] = [];
    if (leaseWin) times.push(leaseWin.start.getTime(), leaseWin.end.getTime());
    for (const c of checkpoints) times.push(c.timestamp);
    const fitted = fitWindow(times, HALF_HOUR_MS, 10 * 60 * 60 * 1000);
    const window = fitted ?? todayWindow();
    return {
      detailResources,
      detailEvents,
      checkpoints,
      start: window.start,
      end: window.end,
    };
  }, [selected]);

  // Selecting a bounty loads its detail timeline. Never navigates away:
  // review/approve lives in the ReviewQueue tab.
  const selectBounty = (id: string) => {
    if (!id || id.endsWith("-chk")) return;
    setSelectedId(id);
  };

  const activeCount = effectiveBounties.filter((b) => b.status === "IN_PROGRESS").length;
  const openCount = effectiveBounties.filter((b) => b.status === "OPEN_FOR_CLAIM").length;

  return (
    <div className="px-4 lg:px-6 space-y-4">
      <div className="pb-3 border-b border-border flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-foreground tracking-tight flex items-center gap-2">
            <CalendarClock className="size-4" />
            <span>Lease Timeline</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground">
              {activeCount} active {activeCount === 1 ? "lease" : "leases"}
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground">
              {openCount} open {openCount === 1 ? "bounty" : "bounties"}
            </span>
            {showDemo ? (
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground">
                incl. demo
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <img
            src={
              theme === "dark"
                ? "/powered-by-bryntum-dark.svg"
                : "/powered-by-bryntum-light.svg"
            }
            alt="Powered by Bryntum"
            className="h-5 w-auto"
            loading="lazy"
          />
          <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showDemo}
                    onCheckedChange={setShowDemo}
                    aria-label="Toggle demo data"
                  />
                  <Label className="text-sm text-muted-foreground font-mono">
                    Demo data
                  </Label>
                </div>
              }
            />
            <TooltipContent side="left">
              Loads 100 demo bounties (demo-*) alongside real data so lease
              bars, escrow holds, and checkpoints have something to chew on.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        </div>
      </div>

      {effectiveBounties.length === 0 ? (
        <div className="p-8 text-center rounded-md border border-dashed border-border bg-muted/20">
          <CalendarClock className="size-8 text-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No bounties to schedule</p>
          <p className="text-sm text-muted-foreground mt-1">
            Post a bounty and its lease will appear here as a time bar.
          </p>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-4 pb-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <LegendMark kind="lease" /> lease
              </span>
              <span className="flex items-center gap-1.5">
                <LegendMark kind="escrow" /> escrow hold
              </span>
            </div>
            <div
              className="rounded-md border border-border overflow-hidden bg-card"
              data-theme={theme}
            >
              <BryntumScheduler
                key={`overview-${overviewStart.getTime()}-${overviewEnd.getTime()}`}
                startDate={overviewStart}
                endDate={overviewEnd}
                viewPreset="hourAndDay"
                rowHeight={44}
                barMargin={6}
                autoHeight={true}
                readOnly={true}
                zoomOnMouseWheel={true}
                eventStyle="rounded"
                timeRangesFeature={{ showCurrentTimeLine: true }}
                eventTooltipFeature={true}
                resources={visibleResources}
                events={visibleEvents}
                columns={[
                  { text: "Bounty", field: "name", width: 220 },
                  { text: "Agent", field: "agent", width: 130 },
                  {
                    text: "Escrow",
                    field: "escrow",
                    width: 90,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    renderer: ({ value }: any) => `$${Number(value ?? 0).toFixed(2)}`,
                  },
                  { text: "PayPal", field: "paypal", width: 110 },
                  { text: "Status", field: "status", width: 150 },
                ]}
                onEventClick={({ eventRecord }: { eventRecord: { id: string | number } }) => {
                  const id = String(eventRecord.id)
                    .replace(/^evt-/, "")
                    .replace(/^escrow-/, "");
                  selectBounty(id);
                }}
                onCellClick={(e: any) => {
                  const rec = e?.record;
                  const id = rec ? String(rec.id ?? rec?.data?.id ?? "") : "";
                  selectBounty(id);
                }}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                Showing {visibleResources.length} of {resources.length}
              </p>
              {visibleCount < resources.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((c) => Math.min(c + PAGE_SIZE, resources.length))
                  }
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-mono text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Load more
                </button>
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground">
                  All bounties shown
                </p>
              )}
            </div>
          </div>

          {selected && detail ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label
                  htmlFor="bounty-search"
                  className="text-base font-medium text-foreground tracking-tight"
                >
                  Bounty timeline
                </Label>
                <div className="relative w-full">
                  <Input
                    id="bounty-search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => setSearchOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchOpen(false);
                      if (e.key === "Enter" && searchMatches.length > 0) {
                        selectBounty(searchMatches[0].id);
                        setQuery("");
                        setSearchOpen(false);
                      }
                    }}
                    placeholder={`Search ${effectiveBounties.length} bounties by title, id, or agent…`}
                    startIcon={<Search className="size-4" />}
                    role="combobox"
                    aria-expanded={searchOpen && searchMatches.length > 0}
                    aria-controls="bounty-search-results"
                    autoComplete="off"
                  />
                  {searchOpen && searchMatches.length > 0 ? (
                    <ul
                      id="bounty-search-results"
                      role="listbox"
                      className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
                    >
                      {searchMatches.map((b) => (
                        <li key={b.id} role="option" aria-selected={b.id === selected.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              selectBounty(b.id);
                              setQuery("");
                              setSearchOpen(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                          >
                            <span className="truncate text-foreground">
                              {b.title}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground ml-auto shrink-0 uppercase">
                              {b.status.replace(/_/g, " ")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p
                  className="text-sm font-medium text-foreground truncate"
                  title={selected.title}
                >
                  {selected.title}
                </p>
                {(() => {
                  const pill = bountyStatusPill(selected.status);
                  return (
                    <span
                      className="font-mono text-[11px] px-1.5 py-0.5 rounded uppercase shrink-0"
                      style={{ background: pill.bg, color: pill.fg }}
                    >
                      {selected.status.replace(/_/g, " ")}
                    </span>
                  );
                })()}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {selected.workerAgentId || "unclaimed"} · $
                {Number(selected.escrowAmount ?? 0).toFixed(2)} ·{" "}
                {paypalShort(selected)}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <LegendMark kind="lease" /> lease
                </span>
                <span className="flex items-center gap-1.5">
                  <LegendMark kind="escrow" /> escrow hold
                </span>
                <span className="flex items-center gap-1.5">
                  <LegendMark kind="checkpoint" /> checkpoint
                </span>
              </div>
              <div
                className="rounded-md border border-border overflow-hidden bg-card"
                data-theme={theme}
              >
                <BryntumScheduler
                  key={`detail-${selected.id}-${detail.start.getTime()}-${detail.end.getTime()}`}
                  startDate={detail.start}
                  endDate={detail.end}
                  viewPreset="hourAndDay"
                  rowHeight={44}
                  barMargin={6}
                  autoHeight={true}
                  readOnly={true}
                  zoomOnMouseWheel={true}
                  eventStyle="rounded"
                  timeRangesFeature={{ showCurrentTimeLine: true }}
                  eventTooltipFeature={true}
                  resources={detail.detailResources}
                  events={detail.detailEvents}
                  columns={[
                    { text: "Row", field: "name", width: 220 },
                    { text: "Detail", field: "detail", width: 220 },
                  ]}
                />
              </div>
              <div className="rounded-md border border-border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-medium text-foreground">
                    Checkpoints
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground">
                    {detail.checkpoints.length}
                  </span>
                </div>
                {detail.checkpoints.length > 0 ? (
                  <ul className="max-h-48 overflow-y-auto px-3">
                    {detail.checkpoints.map((c, i) => {
                      const pill = stagePill(c.stage);
                      return (
                        <li
                          key={`${c.timestamp}-${i}`}
                          className="flex items-center gap-2 min-h-9 py-1.5 border-b border-border/50 last:border-0"
                        >
                          <span
                            className="font-mono text-[11px] px-1.5 py-0.5 rounded uppercase shrink-0"
                            style={{ background: pill.bg, color: pill.fg }}
                          >
                            {c.stage.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-border text-foreground shrink-0 tabular-nums">
                            {new Date(c.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className="text-sm text-muted-foreground truncate"
                            title={c.summary}
                          >
                            {c.summary}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground ml-auto shrink-0 tabular-nums">
                            {c.testsPassed}/{c.testsTotal} tests
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No checkpoints recorded yet — the agent pushes one per
                    milestone via MCP to extend its lease.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="text-sm text-muted-foreground">
        Read-only for v1 — bars move on claim, checkpoint, approve, capture,
        and void.
      </p>
    </div>
  );
}
