import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Lock,
  RefreshCw,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Bounty } from "../types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ZeroLeakCanvasViewer } from "./ZeroLeakCanvasViewer";

interface ReviewQueueProps {
  bounties: Bounty[];
  onSettled?: (bountyId: string) => void;
  onRefunded?: (bountyId: string) => void;
}

const isWebApp = (b: Bounty) => /web/i.test(b.category);

function Meta({ label, children }: { label: string; children: React.ReactNode }) {  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <span className="font-mono text-sm text-foreground">{children}</span>
    </div>
  );
}

type GateDetailShape = NonNullable<NonNullable<Bounty["verificationSummary"]>["gateDetail"]>;

function GateRow({
  name,
  passed,
  score,
  children,
}: {
  name: string;
  passed?: boolean;
  score?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="pt-2 mt-2 border-t border-border/60 first:border-t-0 first:pt-0 first:mt-0">
      <div className="flex items-center justify-between font-mono text-sm">
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${passed === false ? "bg-rose-500" : "bg-emerald-500"}`}
          />
          <span className="text-foreground">{name}</span>
        </span>
        <span className="text-muted-foreground">
          {passed === false ? "failed" : "passed"}
          {typeof score === "number" ? ` · ${score}/100` : ""}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Per-gate breakdown: why the machine verdict is what it is. Same data agents see in list JSON. */
function GateDetail({ detail }: { detail: GateDetailShape }) {
  const c = detail.contract;
  const s = detail.security;
  const a = detail.ai;
  return (
    <div className="mt-2 rounded-md border border-border bg-card p-3 text-sm">
      {typeof detail.overallScore === "number" && (
        <div className="font-mono text-sm text-muted-foreground mb-1">
          Overall gate score: <span className="text-foreground">{detail.overallScore}/100</span>
        </div>
      )}
      {c && (
        <GateRow name="Contract probing" passed={c.passed} score={c.score}>
          <p className="font-mono text-sm text-muted-foreground mt-1">
            {c.passedEndpoints ?? "?"}/{c.totalEndpoints ?? "?"} endpoints
            {typeof c.p95LatencyMs === "number" ? ` · p95 ${c.p95LatencyMs}ms` : ""}
            {c.slaPassed === false ? " · SLA breached" : ""}
          </p>
          {(c.failedProbes || []).map((p, i) => (
            <p key={i} className="font-mono text-sm text-rose-500 mt-1">
              {p.endpoint} → HTTP {p.statusCode}
              {(p.errors || []).slice(0, 1).map((e, j) => (
                <span key={j} className="block text-muted-foreground">{e}</span>
              ))}
            </p>
          ))}
        </GateRow>
      )}
      {s && (
        <GateRow name="Security & anti-cheat" passed={s.passed} score={s.score}>
          <p className="font-mono text-sm text-muted-foreground mt-1">
            {s.vulnerabilitiesFound ?? 0} vulnerabilities
            {s.antiCheatPassed === false ? " · mock/stub detected" : ""}
          </p>
          {(s.failedChecks || []).map((ch, i) => (
            <p key={i} className="font-mono text-sm text-rose-500 mt-1">
              {ch.name || ch.type}
              {ch.details ? <span className="block text-muted-foreground">{ch.details}</span> : null}
            </p>
          ))}
        </GateRow>
      )}
      {a && (
        <GateRow name="AI semantic audit" passed={a.passed} score={a.score}>
          {a.summary ? <p className="text-sm text-muted-foreground mt-1">{a.summary}</p> : null}
          {(a.failedRequirements || []).map((r, i) => (
            <p key={i} className="text-sm text-rose-500 mt-1">
              {r.requirement}
              {r.observations ? <span className="block text-muted-foreground">{r.observations}</span> : null}
            </p>
          ))}
        </GateRow>
      )}
    </div>
  );
}

export function ReviewQueue({
  bounties,
  onSettled,
  onRefunded,
}: ReviewQueueProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState<"capture" | "void" | "reject" | null>(null);
  const [modal, setModal] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelAck, setCancelAck] = useState(false);

  const queue = bounties.filter((b) => b.status === "READY_FOR_REVIEW");
  const provisioning = bounties.filter((b) => b.status === "PROVISIONING");
  // Infra failures go back to IN_PROGRESS with provisionError: no sandbox, so
  // nothing to review — but the buyer should still see WHY it is stuck.
  const failedProvision = bounties.filter(
    (b) => b.status === "IN_PROGRESS" && b.provisionError
  );
  const selected = queue.find((b) => b.id === selectedId) || null;

  const open = (id: string) => {
    setSelectedId(id);
    setPreviewing(false);
  };
  const back = () => {
    setSelectedId(null);
    setPreviewing(false);
  };

  const doCapture = async (b: Bounty) => {
    setBusy("capture");
    try {
      const res = await fetch(`/api/bounties/${b.id}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attestationHash: b.verificationSummary?.artifactSha256 || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { developerPayout?: string; platformFee?: string; payoutStatus?: string };
      onSettled?.(b.id);
      toast.success(`Settled: ${data.developerPayout || ""} → developer, ${data.platformFee || ""} platform fee. Code unlocked for download.`);
      // Hand the buyer the code immediately — same signed-URL flow as Payments.
      // No vault (e.g. pure preview deliverables) → skip silently, toast already confirms.
      try {
        const dl = await fetch(`/api/bounties/${b.id}/artifact/download`);
        if (dl.ok) {
          const { url } = (await dl.json()) as { url: string };
          if (url) window.location.href = url;
        }
      } catch {
        // Download stays available under Payments → escrow row.
      }
      setModal(null);
      back();
    } catch (err) {
      toast.error(`Failed to capture escrow: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const doReject = async (b: Bounty) => {
    if (rejectReason.trim().length < 10) {
      toast.error("Rejection reason required (min 10 chars) — shown to the next agent.");
      return;
    }
    setBusy("reject");
    try {
      const res = await fetch(`/api/bounties/${b.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.info("Deliverable rejected — escrow stays locked, bounty re-opened for the next agent.");
      setModal(null);
      setRejectReason("");
      back();
    } catch (err) {
      toast.error(`Failed to reject: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const doVoid = async (b: Bounty) => {
    if (!cancelAck) {
      toast.error("Please acknowledge the cancellation terms first.");
      return;
    }
    setBusy("void");
    try {
      const res = await fetch(`/api/bounties/${b.id}/void`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { amountRefunded?: string; voidFee?: string };
      onRefunded?.(b.id);
      toast.info(`Bounty cancelled. Refunded ${data.amountRefunded || ""}${data.voidFee && data.voidFee !== "0.00 USD" ? ` (1% fee ${data.voidFee} retained)` : " (no fee — no work attempted)"}.`);
      setModal(null);
      setCancelAck(false);
      back();
    } catch (err) {
      toast.error(`Failed to void escrow: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  // ---------- Detail view ----------
  if (selected) {
    const pct = Math.round(
      (selected.testsPassed / (selected.testsTotal || 1)) * 100
    );
    return (
      <div className="px-4 lg:px-6 space-y-5">
        <button
          onClick={back}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to review queue</span>
        </button>

        <div className="rounded-lg border border-border bg-card p-5 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {selected.category}
                </span>
                <span className="text-muted-foreground/60">•</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {selected.id}
                </span>
              </div>
              <h3 className="text-base font-medium text-foreground tracking-tight">
                {selected.title}
              </h3>
              {selected.description && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl pt-0.5">
                  {selected.description.split("\n\n")[0]}
                </p>
              )}
            </div>
            <div className="sm:text-right shrink-0 space-y-1.5">
              <div className="flex sm:justify-end items-baseline gap-1">
                <span className="font-mono text-lg font-semibold text-foreground">
                  ${selected.escrowAmount.toFixed(2)}
                </span>
                <span className="font-mono text-sm text-muted-foreground">
                  {selected.currency || "USD"}
                </span>
              </div>
              <Badge variant="emerald" className="text-[10px] tracking-wide">
                Pending Your Approval
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Meta label="Automated Tests">
              {selected.testsPassed}/{selected.testsTotal} Passed ({pct}%)
            </Meta>
            <Meta label="Worker Agent">
              {selected.workerAgentId || "agent-mcp-worker"}
            </Meta>
            <Meta label="Escrow Hold">
              {selected.payPalAuthorizationId || "—"}
            </Meta>
            <Meta label="Final Stage">{selected.currentStage}</Meta>
            {selected.timeline && <Meta label="Timeline">{selected.timeline}</Meta>}
            {selected.techConstraints && <Meta label="Tech Constraints">{selected.techConstraints}</Meta>}
          </div>

          {(selected.requirements?.length || selected.acceptanceCriteria?.length) ? (
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {selected.requirements?.length ? (
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Requirements</div>
                  <ul className="space-y-1.5">
                    {selected.requirements.map((r, i) => <li key={i} className="flex gap-1.5 text-muted-foreground"><span className="text-foreground">–</span><span className="text-foreground">{r}</span></li>)}
                  </ul>
                </div>
              ) : null}
              {selected.acceptanceCriteria?.length ? (
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Acceptance checklist</div>
                  <ul className="space-y-1.5">
                    {selected.acceptanceCriteria.map((a, i) => <li key={i} className="flex gap-1.5 items-start"><Square className="size-3.5 text-muted-foreground shrink-0 mt-0.5" /><span className="text-foreground">{a}</span></li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Code vault status — sealed source is what the buyer receives on Approve */}
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm">
            <Lock className="size-3.5 text-foreground shrink-0 mt-0.5" />
            {selected.artifactSha256 ? (
              <span className="text-muted-foreground">
                Code vault sealed •{" "}
                <code className="font-mono text-foreground">
                  sha256:{selected.artifactSha256.slice(0, 16)}…
                </code>{" "}
                — released to you on Approve. Pixels only until then.
              </span>
            ) : (
              <span className="text-muted-foreground">
                No code vault yet —{" "}
                {isWebApp(selected)
                  ? "the running preview is the deliverable; source transfer is arranged on approval."
                  : "ask the worker to run aegis_upload_artifact before you approve, or the API gates have nothing to run."}
              </span>
            )}
          </div>

          <div className="flex items-start gap-2 pt-4 border-t border-border text-sm text-muted-foreground">
            <ShieldCheck className="size-3.5 text-foreground shrink-0 mt-0.5" />
            <span>
              Source code stays sealed until you release payment.
              {isWebApp(selected)
                ? " You can interact with the running app in an isolated sandbox; only pixels are streamed."
                : " API deliverables are verified by the arbiter's contract, security and AI gates."}
            </span>
          </div>

          {selected.verificationSummary && (
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                Arbiter gate report (automated — not your decision)
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono">
                <span>
                  <span className="text-muted-foreground">Machine verdict: </span>
                  <span className="text-foreground">{selected.verificationSummary.verdict || "—"}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Inspected bytes: </span>
                  <span className="text-foreground">
                    {selected.verificationSummary.artifactSha256
                      ? `sha256:${selected.verificationSummary.artifactSha256.slice(0, 16)}…`
                      : "—"}
                  </span>
                </span>
              </div>
              {selected.verificationSummary.verdict === "REJECTED" && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  One or more automated gates failed on the sandbox. You can still
                  approve, or reject &amp; requeue with the failure reason for the next agent.
                </p>
              )}
              {selected.verificationSummary.gateDetail && (
                <GateDetail detail={selected.verificationSummary.gateDetail} />
              )}
            </div>
          )}
        </div>

        {/* Preview (web apps only, started explicitly by the reviewer) */}
        {isWebApp(selected) &&
          (previewing ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewing(false)}
                  className="text-sm"
                >
                  <X className="size-3 mr-1" />
                  <span>End preview</span>
                </Button>
              </div>
              <ZeroLeakCanvasViewer bounty={selected} hideSettlement />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-foreground">
                  Live sandbox preview
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Starting the preview boots an isolated browser session for this
                  deliverable.
                </p>
              </div>
              <Button size="sm" onClick={() => setPreviewing(true)} className="text-sm">
                <Eye className="size-3.5 mr-1" />
                <span>Launch preview</span>
              </Button>
            </div>
          ))}

        {/* Settlement */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 text-[#0070ba] shrink-0" />
            <span>
              <strong className="font-mono text-sm text-foreground">
                ${selected.escrowAmount.toFixed(2)} USD
              </strong>{" "}
              locked in PayPal escrow
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => { setModal("reject"); }}
              className="flex-1 sm:flex-initial text-sm"
            >
              <span>Reject &amp; requeue</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy !== null}
              onClick={() => { setModal("cancel"); setCancelAck(false); }}
              className="flex-1 sm:flex-initial text-sm"
            >
              <span>Cancel bounty</span>
            </Button>
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() => { setModal("approve"); }}
              className="flex-1 sm:flex-initial text-sm"
            >
              <CheckCircle2 className="size-3 mr-1" />
              <span>Approve &amp; Release ${selected.escrowAmount.toFixed(2)}</span>
            </Button>
          </div>
        </div>

        {modal === "approve" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm" onClick={() => setModal(null)}>
            <div className="w-full max-w-md rounded-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-semibold text-foreground">Approve &amp; release payment?</h4>
              <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Escrow captured</span><span>${selected.escrowAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Developer receives (95%)</span><span className="text-emerald-500">${(selected.escrowAmount * 0.95).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (5%)</span><span>${(selected.escrowAmount * 0.05).toFixed(2)}</span></div>
                <div className="flex justify-between pt-1 border-t border-border"><span className="text-muted-foreground">Buyer gets</span><span>code download (7-day link)</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receipt</span><span>PayPal invoice to both parties</span></div>
              </div>
              <p className="text-sm text-muted-foreground">Payment is final. The developer is paid via PayPal Payouts and the sealed code vault unlocks for download. Ensure pixels + gate report match your expectations.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setModal(null)}>Back</Button>
                <Button size="sm" disabled={busy !== null} onClick={() => doCapture(selected)}>
                  {busy === "capture" ? <RefreshCw className="size-3 mr-1 animate-spin" /> : null}
                  <span>Confirm approval</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {modal === "reject" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm" onClick={() => setModal(null)}>
            <div className="w-full max-w-md rounded-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-semibold text-foreground">Reject this deliverable?</h4>
              <p className="text-sm text-muted-foreground">Free. Escrow stays locked (${selected.escrowAmount.toFixed(2)}), rejected code is destroyed immediately, bounty re-opens for the next agent. Your reason is shown to them.</p>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="What failed? Be specific — tests, layout, missing endpoints… (min 10 chars)"
                className="w-full px-3 py-2 rounded border border-border bg-muted/20 text-sm focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setModal(null)}>Back</Button>
                <Button size="sm" disabled={busy !== null} onClick={() => doReject(selected)}>
                  {busy === "reject" ? <RefreshCw className="size-3 mr-1 animate-spin" /> : null}
                  <span>Reject &amp; requeue</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {modal === "cancel" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm" onClick={() => setModal(null)}>
            <div className="w-full max-w-md rounded-md border border-rose-500/40 bg-white dark:bg-[#09090b] shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-semibold text-rose-500">Cancel bounty &amp; void escrow?</h4>
              {(() => {
                const attempted = (selected.claimCount || 0) > 0 || (selected.workerHistory || []).length > 0;
                const fee = attempted ? selected.escrowAmount * 0.01 : 0;
                return (
                  <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-sm space-y-1.5">
                    <div className="flex justify-between"><span className="text-muted-foreground">Work attempted</span><span>{attempted ? `yes (${selected.claimCount || 1} claim(s))` : "no"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Void fee (1% if attempted)</span><span>${fee.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">You receive</span><span>${(selected.escrowAmount - fee).toFixed(2)}</span></div>
                  </div>
                );
              })()}
              <p className="text-sm text-muted-foreground">Irreversible. Sealed code and sandbox are destroyed immediately. Voiding is not how you reject one bad submission — use Reject &amp; requeue for that.</p>
              <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={cancelAck} onChange={(e) => setCancelAck(e.target.checked)} className="mt-0.5 size-3.5" />
                <span>I understand this cancels the entire bounty and cannot be undone.</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setModal(null)}>Back</Button>
                <Button variant="destructive" size="sm" disabled={busy !== null} onClick={() => doVoid(selected)}>
                  {busy === "void" ? <RefreshCw className="size-3 mr-1 animate-spin" /> : null}
                  <span>Void escrow</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- List view ----------
  return (
    <div className="px-4 lg:px-6 space-y-5">
      <div className="pb-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
          <CheckCircle2 className="size-4" />
          <span>Deliverable Approvals</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review submitted work before releasing escrow payment.
        </p>
      </div>

      {provisioning.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Sandbox verification in progress
          </div>
          {provisioning.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-border bg-card p-5 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground tracking-tight">
                  {b.title}
                </div>
                <Badge variant="amber" className="text-[10px] tracking-wide shrink-0">
                  Provisioning
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="size-3.5 animate-spin shrink-0" />
                <span className="font-mono">
                  {b.latestProgress || "Queued for sandbox provisioning"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The arbiter is building an isolated sandbox from the sealed code vault.
                Your preview appears here automatically once it&apos;s ready.
              </p>
            </div>
          ))}
        </div>
      )}

      {failedProvision.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Needs agent attention (sandbox failed — escrow untouched)
          </div>
          {failedProvision.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-rose-500/40 bg-card p-5 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground tracking-tight">
                  {b.title}
                </div>
                <Badge variant="destructive" className="text-[10px] tracking-wide shrink-0">
                  Provision failed
                </Badge>
              </div>
              <p className="font-mono text-sm text-rose-500">{b.provisionError}</p>
              <p className="text-[11px] text-muted-foreground">
                The agent sees the same error and can fix, re-seal, and re-deliver.
                Re-delivery retries provisioning automatically.
              </p>
            </div>
          ))}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="p-8 text-center rounded-md border border-dashed border-border bg-muted/20">
          <CheckCircle2 className="size-8 text-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">
            No deliverables pending approval
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Agent submissions requiring your verification will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((b) => (
            <button
              key={b.id}
              onClick={() => open(b.id)}
              className="w-full text-left rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm transition-all hover:border-zinc-400 dark:hover:border-zinc-700 cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {b.category}
                    </span>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {b.id}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-foreground tracking-tight">
                    {b.title}
                  </h3>
                  {b.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
                      {b.description}
                    </p>
                  )}
                </div>
                <div className="sm:text-right shrink-0 space-y-1.5">
                  <div className="flex sm:justify-end items-baseline gap-1">
                    <span className="font-mono text-lg font-semibold text-foreground">
                      ${b.escrowAmount.toFixed(2)}
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">
                      {b.currency || "USD"}
                    </span>
                  </div>
                  <Badge variant="emerald" className="text-[10px] tracking-wide">
                    Pending Your Approval
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
                <div className="flex flex-wrap items-center gap-6">
                  <Meta label="Automated Tests">
                    {b.testsPassed}/{b.testsTotal} Passed
                  </Meta>
                  <Meta label="Worker Agent">
                    {b.workerAgentId || "agent-mcp-worker"}
                  </Meta>
                  <Meta label="Preview">
                    {isWebApp(b) ? "Interactive sandbox" : "Gate report only"}
                  </Meta>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    <span>Awaiting your review</span>
                  </span>
                  <span className="flex items-center gap-0.5 font-medium text-foreground">
                    Review <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
