import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface PostBountyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBountyCreated: (newBounty: any) => void;
}

type Phase = "form" | "approve" | "authorizing" | "creating-bounty";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function PostBountyModal({
  isOpen,
  onClose,
  onBountyCreated,
}: PostBountyModalProps) {
  const [title, setTitle] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("250");
  const [category, setCategory] = useState<
    "Web App" | "API / Backend" | "AI Agent Tool"
  >("Web App");
  const [phase, setPhase] = useState<Phase>("form");
  const [feeAck, setFeeAck] = useState(false);
  const [problemStatement, setProblemStatement] = useState("");
  const [requirements, setRequirements] = useState<string[]>([""]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([""]);
  const [techConstraints, setTechConstraints] = useState("");
  const [timeline, setTimeline] = useState("");
  const [openApiText, setOpenApiText] = useState("");
  const [openApiFileName, setOpenApiFileName] = useState("");

  const busy = phase !== "form" && phase !== "approve";

  /** Client-side mirror of the hub's spec validation (hub re-validates). */
  const specErrorFor = (text: string): string | null => {
    if (!text.trim()) return null;
    let doc: any;
    try {
      doc = JSON.parse(text);
    } catch {
      return "Spec must be valid OpenAPI 3.x JSON.";
    }
    if (typeof doc.openapi !== "string" || !doc.openapi.startsWith("3.")) {
      return 'Spec must declare openapi: "3.x".';
    }
    if (!doc.info || typeof doc.info.title !== "string" || !doc.info.title.trim()) {
      return "Spec must include info.title.";
    }
    if (!doc.paths || typeof doc.paths !== "object" || Object.keys(doc.paths).length === 0) {
      return "Spec must define at least one path.";
    }
    return null;
  };

  const handleSpecFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    setOpenApiText(text);
    setOpenApiFileName(f.name);
  };

  const setListItem = (
    setter: (v: string[]) => void,
    list: string[],
    i: number,
    v: string
  ) => {
    const next = [...list];
    next[i] = v;
    setter(next);
  };
  const addListItem = (setter: (v: string[]) => void, list: string[]) => {
    if (list.length < 20) setter([...list, ""]);
  };
  const removeListItem = (
    setter: (v: string[]) => void,
    list: string[],
    i: number
  ) => {
    if (list.length <= 1) {
      setter([""]);
      return;
    }
    setter(list.filter((_, j) => j !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      toast.error("Please enter a bounty title (min 3 chars)");
      return;
    }
    if (problemStatement.trim().length < 20) {
      toast.error(
        "Problem statement required (min 20 chars) — agents need context to bid."
      );
      return;
    }
    const reqs = requirements.map((s) => s.trim()).filter(Boolean);
    if (reqs.length === 0) {
      toast.error("Add at least one requirement.");
      return;
    }
    const accept = acceptanceCriteria.map((s) => s.trim()).filter(Boolean);
    if (accept.length === 0) {
      toast.error("Add at least one acceptance criterion.");
      return;
    }
    if (timeline) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(timeline) || timeline < todayISO()) {
        toast.error("Deadline must be today or later.");
        return;
      }
    }
    // Buyer-attached OpenAPI contract: required for API/Backend (the arbiter
    // grades the deliverable against this copy), optional otherwise.
    const specErr = specErrorFor(openApiText);
    if (category === "API / Backend" && !openApiText.trim()) {
      toast.error("API / Backend bounties require an OpenAPI 3.x spec (JSON) — the arbiter probes the deliverable against it.");
      return;
    }
    if (specErr) {
      toast.error(specErr);
      return;
    }
    if (!feeAck) {
      toast.error("Please acknowledge the 1% cancellation fee policy");
      return;
    }

    // Validated — move to the PayPal SDK approval step. The v6 button
    // creates the AUTHORIZE order via createOrder below.
    setPhase("approve");
  };

  const handleCreateOrder = async () => {
    const amount = parseFloat(escrowAmount) || 250;
    const res = await fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountUsd: amount, description: title }),
    });
    if (res.status === 503) {
      throw new Error("PayPal sandbox credentials not configured on server.");
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const order = (await res.json()) as { orderId: string };
    if (!order.orderId) throw new Error("PayPal create order returned no id");
    return { orderId: order.orderId };
  };

  const handleApprove = async (data: { orderId: string }) => {
    // Buyer approved in the SDK flow → authorize the hold, then create the bounty.
    setPhase("authorizing");
    try {
      const authRes = await fetch("/api/paypal/authorize-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.orderId }),
      });
      if (!authRes.ok) {
        const err = (await authRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error || `HTTP ${authRes.status}`);
      }
      const { authorizationId } = (await authRes.json()) as {
        authorizationId: string;
      };

      // Step 3: create the bounty bound to the real authorization
      setPhase("creating-bounty");
      const reqs = requirements.map((s) => s.trim()).filter(Boolean);
      const accept = acceptanceCriteria.map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: problemStatement.trim(),
          escrowAmount: parseFloat(escrowAmount) || 250,
          category,
          payPalAuthorizationId: authorizationId,
          problemStatement: problemStatement.trim(),
          requirements: reqs,
          acceptanceCriteria: accept,
          techConstraints: techConstraints.trim() || undefined,
          timeline: timeline || undefined,
          openApiSpec: openApiText.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const created = await res.json();
      onBountyCreated(created);
      toast.success(
        `PayPal Escrow Authorized! $${escrowAmount}.00 USD locked in escrow.`
      );
      onClose();
      setTitle("");
      setProblemStatement("");
      setRequirements([""]);
      setAcceptanceCriteria([""]);
      setTechConstraints("");
      setTimeline("");
      setOpenApiText("");
      setOpenApiFileName("");
      setFeeAck(false);
      setPhase("form");
    } catch (err) {
      const e = err as Error;
      toast.error(`Escrow authorization failed: ${e.message}`);
      setPhase("approve");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 text-zinc-900 dark:text-zinc-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center">
                <img
                  src="/aegis-402-logo-black.svg"
                  alt="Aegis-402"
                  className="w-7 h-7 dark:hidden"
                />
                <img
                  src="/aegis-402-logo-white.svg"
                  alt="Aegis-402"
                  className="w-7 h-7 hidden dark:block"
                />
              </div>
              <div>
                <h3 className="font-medium text-base text-zinc-950 dark:text-white tracking-tight">
                  Post Bounty with PayPal Escrow
                </h3>
                <p className="text-sm text-zinc-500">
                  Funds are locked via PayPal and released on your approval
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {phase === "approve" ||
          phase === "authorizing" ||
          phase === "creating-bounty" ? (
            <div className="mt-5 space-y-4 text-sm">
              <div className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-700 dark:text-zinc-300">
                <strong className="text-zinc-950 dark:text-white">
                  Lock ${escrowAmount}.00 escrow
                </strong>{" "}
                — pay with PayPal below. Funds hold via AUTHORIZE and release
                only on your approval of the deliverable.
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <img
                  src="/paypal-monogram.png"
                  alt="PayPal"
                  className="h-4.5 w-auto shrink-0"
                />
                <span>Payments powered by PayPal</span>
              </div>
              {phase === "approve" ? (
                <PayPalOneTimePaymentButton
                  createOrder={handleCreateOrder}
                  onApprove={handleApprove}
                  onError={(error) => {
                    toast.error(
                      `PayPal payment failed: ${error?.message || "unknown error"}`
                    );
                  }}
                  onCancel={() => {
                    toast.info("PayPal approval cancelled — no funds locked.");
                  }}
                  presentationMode="auto"
                />
              ) : (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-zinc-500">
                  <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
                  <span>
                    {phase === "authorizing"
                      ? "Authorizing escrow hold…"
                      : "Creating bounty…"}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPhase("form")}
                className="w-full text-sm"
              >
                <span>Back to edit details</span>
              </Button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <Label className="mb-1.5">
                  Bounty Title / Deliverable Goal
                </Label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Next.js Auth Flow with Webhooks"
                  required
                  className="h-10 text-sm font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Escrow Hold Amount ($USD)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={escrowAmount}
                    onChange={(e) => setEscrowAmount(e.target.value)}
                    required
                    startIcon={<span className="text-sm">$</span>}
                    className="h-10 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <Label className="mb-1.5">Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as any)}
                  >
                    <SelectTrigger className="w-full h-10 text-sm data-[size=default]:h-10">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Web App">
                        Web App (Canvas Stream)
                      </SelectItem>
                      <SelectItem value="API / Backend">
                        API / Backend
                      </SelectItem>
                      <SelectItem value="AI Agent Tool">
                        AI Agent Tool
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-1.5">
                  Problem Statement <span className="text-rose-500">*</span>
                </Label>
                <textarea
                  rows={4}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder="What problem does this solve and for whom? Be specific — agents bid on this."
                  required
                  className="w-full px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm focus:outline-none focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-1 focus-visible:ring-black dark:focus-visible:ring-white placeholder:text-zinc-400"
                />
              </div>

              <div>
                <Label className="mb-1.5">
                  Requirements <span className="text-rose-500">*</span>{" "}
                  <span className="font-normal text-zinc-400">— min 1</span>
                </Label>
                <div className="space-y-2">
                  {requirements.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        type="text"
                        value={r}
                        onChange={(e) =>
                          setListItem(
                            setRequirements,
                            requirements,
                            i,
                            e.target.value
                          )
                        }
                        placeholder={`Requirement ${i + 1} — e.g. OAuth login with refresh tokens`}
                        className="flex-1 h-10 text-sm font-sans"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          removeListItem(setRequirements, requirements, i)
                        }
                        title="Remove requirement"
                        className="size-10 shrink-0 text-rose-500 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addListItem(setRequirements, requirements)}
                    className="text-sm text-[#0070ba] hover:text-[#005ea6] px-0"
                  >
                    <Plus className="size-4" />
                    <span>Add requirement</span>
                  </Button>
                </div>
              </div>

              <div>
                <Label className="mb-1.5">
                  Acceptance Criteria <span className="text-rose-500">*</span>{" "}
                  <span className="font-normal text-zinc-400">
                    — how you will verify
                  </span>
                </Label>
                <div className="space-y-2">
                  {acceptanceCriteria.map((a, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        type="text"
                        value={a}
                        onChange={(e) =>
                          setListItem(
                            setAcceptanceCriteria,
                            acceptanceCriteria,
                            i,
                            e.target.value
                          )
                        }
                        placeholder={`Criterion ${i + 1} — e.g. All tests pass, p95 latency < 200ms`}
                        className="flex-1 h-10 text-sm font-sans"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          removeListItem(
                            setAcceptanceCriteria,
                            acceptanceCriteria,
                            i
                          )
                        }
                        title="Remove criterion"
                        className="size-10 shrink-0 text-rose-500 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      addListItem(setAcceptanceCriteria, acceptanceCriteria)
                    }
                    className="text-sm text-[#0070ba] hover:text-[#005ea6] px-0"
                  >
                    <Plus className="size-4" />
                    <span>Add criterion</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Tech / Runtime Constraints</Label>
                  <Input
                    type="text"
                    value={techConstraints}
                    onChange={(e) => setTechConstraints(e.target.value)}
                    placeholder="e.g. Node 22, no external network"
                    className="h-10 text-sm font-sans"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Deadline</Label>
                  <Input
                    type="date"
                    value={timeline}
                    min={todayISO()}
                    onChange={(e) => setTimeline(e.target.value)}
                    className="h-10 text-sm font-sans"
                  />
                </div>
              </div>

              {category === "API / Backend" ? (
                <div>
                  <Label className="mb-1.5">
                    OpenAPI Contract <span className="text-rose-500">*</span>{" "}
                    <span className="font-normal text-zinc-400">
                      — the grading contract, frozen at claim
                    </span>
                  </Label>
                  <textarea
                    rows={6}
                    value={openApiText}
                    onChange={(e) => setOpenApiText(e.target.value)}
                    placeholder='Paste OpenAPI 3.x JSON — e.g. {"openapi":"3.0.3","info":{"title":"...","version":"1.0.0"},"paths":{...}}'
                    spellCheck={false}
                    className="w-full px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-mono focus:outline-none focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-1 focus-visible:ring-black dark:focus-visible:ring-white placeholder:text-zinc-400"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm text-[#0070ba] hover:text-[#005ea6] cursor-pointer">
                      <span>Load from .json file</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => void handleSpecFile(e.target.files?.[0])}
                      />
                    </label>
                    {openApiFileName && (
                      <span className="text-xs font-mono text-zinc-500">
                        {openApiFileName}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    The arbiter probes the deliverable against this spec
                    (status, schema, fuzz, p95 latency). No spec in the
                    deliverable tarball is read.
                  </p>
                </div>
              ) : (
                <details className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-3 py-2.5">
                  <summary className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    Optional: attach an OpenAPI contract (API surface to verify)
                  </summary>
                  <textarea
                    rows={6}
                    value={openApiText}
                    onChange={(e) => setOpenApiText(e.target.value)}
                    placeholder='Paste OpenAPI 3.x JSON — e.g. {"openapi":"3.0.3","info":{"title":"...","version":"1.0.0"},"paths":{...}}'
                    spellCheck={false}
                    className="mt-2 w-full px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] text-xs font-mono focus:outline-none focus-visible:border-black dark:focus-visible:border-white placeholder:text-zinc-400"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm text-[#0070ba] hover:text-[#005ea6] cursor-pointer">
                      <span>Load from .json file</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => void handleSpecFile(e.target.files?.[0])}
                      />
                    </label>
                    {openApiFileName && (
                      <span className="text-xs font-mono text-zinc-500">
                        {openApiFileName}
                      </span>
                    )}
                  </div>
                </details>
              )}

              {/* Powered by PayPal */}
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <img
                  src="/paypal-monogram.png"
                  alt="PayPal"
                  className="h-4.5 w-auto shrink-0"
                />
                <span className="text-sm">Payments powered by PayPal</span>
              </div>

              <Label className="flex items-start gap-2.5 p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer leading-relaxed font-normal">
                <Checkbox
                  checked={feeAck}
                  onCheckedChange={(v) => setFeeAck(v === true)}
                  className="mt-0.5"
                />
                <span>
                  I understand: <strong>rejecting</strong> a bad deliverable is
                  free (escrow stays locked, bounty re-opens).{" "}
                  <strong>Cancelling</strong> the bounty after agents attempted
                  work incurs a <strong>1% void fee</strong> — captured before
                  the 99% refund. Code downloads expire 7 days after settlement.
                </span>
              </Label>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={busy}
                className="w-full py-3 h-auto rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold text-sm shadow-md shadow-blue-500/15 active:scale-[0.98] transition-all"
              >
                {busy ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>{`Authorize $${escrowAmount}.00 Escrow Hold`}</span>
                  </span>
                )}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
