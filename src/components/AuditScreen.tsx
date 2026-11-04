import { useEffect, useMemo, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import {
  AgStudioAiModule,
  createAiHarness,
  directLlmRunner,
  enableStudioDevValidations,
  studioTheme,
  type AgAiHarnessSetup,
  type AgAiModel,
  type AgAiPromptStarter,
  type AgFieldDefinition,
  type AgLlmAdapter,
  type AgAiEvent,
  type AgLlmResponse,
  type AgReportState,
  type AgStudioTheme,
} from "ag-studio";
import type { Bounty } from "../types";
import { Card } from "./ui/card";

const LICENSE_KEY = (import.meta as any).env?.VITE_AG_STUDIO_LICENSE_KEY || "";

// Module-scope: the React wrapper diffs these props by reference identity —
// fresh literals every render read as "changed" and reset Studio on each poll.
const STUDIO_MODULES = [AgStudioAiModule];
const STUDIO_STYLE = { height: "100%", width: "100%" } as const;

if ((import.meta as any).env?.DEV) {
  enableStudioDevValidations();
}

interface SettlementRow {
  id: string;
  bountyId: string;
  payoutBatchId?: string | null;
  amount: number;
  status: string;
  createdAt: number;
}

interface AuditScreenProps {
  bounties: Bounty[];
  theme: "light" | "dark";
}

const AEGIS_FONT =
  "'Space Grotesk Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Aegis monochrome Studio theme — zinc + PayPal blue + emerald/amber/rose semantics, 6px radii. */
function buildAegisTheme(): AgStudioTheme {
  return studioTheme
    .withParams(
      {
        backgroundColor: "#ffffff",
        foregroundColor: "#09090b",
        textColor: "#09090b",
        subtleTextColor: "#71717a",
        borderColor: "#e4e4e7",
        borderRadius: "6px",
        fontFamily: AEGIS_FONT,
        fontSize: "14px",
        accentColor: "#0070ba",
        browserColorScheme: "light",
        focusShadow: "0 0 0 2px #09090b",
        studioWrapperBackgroundColor: "#ffffff",
        studioCanvasBackgroundColor: "#f8f8f8",
        studioCanvasGridLineColor: "#f0f0f0",
        studioPanelContainerBackgroundColor: "#ffffff",
        studioWidgetBackgroundColor: "#ffffff",
        studioWidgetBorderRadius: "6px",
        studioWidgetTitleFontFamily: AEGIS_FONT,
        studioWidgetTitleFontWeight: "500",
        studioWidgetTitleTextColor: "#09090b",
        gridHeaderBackgroundColor: "#f4f4f5",
        gridHeaderTextColor: "#09090b",
        gridDataBackgroundColor: "#ffffff",
        gridCellTextColor: "#09090b",
        gridFontFamily: AEGIS_FONT,
        gridRowHoverColor: "#f4f4f5",
        chartPaletteFills1Color: "#09090b",
        chartPaletteFills2Color: "#0070ba",
        chartPaletteFills3Color: "#10b981",
        chartPaletteStrokes1Color: "#09090b",
        chartPaletteStrokes2Color: "#0070ba",
        chartPaletteStrokes3Color: "#10b981",
        chartTextColor: "#09090b",
        chartGridLineColor: "#e4e4e7",
        chartAxisLineColor: "#a1a1aa",
        chartFontFamily: AEGIS_FONT,
      },
      "light"
    )
    .withParams(
      {
        backgroundColor: "#09090b",
        foregroundColor: "#fafafa",
        textColor: "#fafafa",
        subtleTextColor: "#a1a1aa",
        borderColor: "#27272a",
        borderRadius: "6px",
        fontFamily: AEGIS_FONT,
        fontSize: "14px",
        accentColor: "#0070ba",
        browserColorScheme: "dark",
        focusShadow: "0 0 0 2px #fafafa",
        studioWrapperBackgroundColor: "#09090b",
        studioCanvasBackgroundColor: "#111113",
        studioCanvasGridLineColor: "#18181b",
        studioPanelContainerBackgroundColor: "#09090b",
        studioWidgetBackgroundColor: "#141416",
        studioWidgetBorderRadius: "6px",
        studioWidgetTitleFontFamily: AEGIS_FONT,
        studioWidgetTitleFontWeight: "500",
        studioWidgetTitleTextColor: "#fafafa",
        gridHeaderBackgroundColor: "#18181b",
        gridHeaderTextColor: "#fafafa",
        gridDataBackgroundColor: "#141416",
        gridCellTextColor: "#fafafa",
        gridFontFamily: AEGIS_FONT,
        gridRowHoverColor: "#18181b",
        chartPaletteFills1Color: "#fafafa",
        chartPaletteFills2Color: "#0070ba",
        chartPaletteFills3Color: "#10b981",
        chartPaletteStrokes1Color: "#fafafa",
        chartPaletteStrokes2Color: "#0070ba",
        chartPaletteStrokes3Color: "#10b981",
        chartTextColor: "#fafafa",
        chartGridLineColor: "#27272a",
        chartAxisLineColor: "#71717a",
        chartFontFamily: AEGIS_FONT,
      },
      "dark"
    );
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Module-scope: Studio keys updates by reference identity, so field definitions
// must be stable for the lifetime of the app (fresh arrays read as "fields
// changed" and row updates get ignored). Currency pattern per AG docs.
const ESCROW_FIELDS: AgFieldDefinition[] = [
  { id: "ref", name: "Ref", format: "textFormat" },
  { id: "title", name: "Title", format: "textFormat" },
  { id: "status", name: "Status", format: "textFormat" },
  { id: "category", name: "Category", format: "textFormat" },
  {
    id: "escrowAmount",
    name: "Escrow",
    format: "currencyFormat",
    formatOptions: { format: "$#,##0.00" },
  },
  {
    id: "platformFee",
    name: "Platform fee",
    format: "currencyFormat",
    formatOptions: { format: "$#,##0.00" },
  },
  {
    id: "developerPayout",
    name: "Developer payout",
    format: "currencyFormat",
    formatOptions: { format: "$#,##0.00" },
  },
  { id: "payoutStatus", name: "Payout", format: "textFormat" },
  { id: "invoiceStatus", name: "Invoice", format: "textFormat" },
  { id: "claimCount", name: "Claims", format: "integerFormat" },
  { id: "rowCount", name: "Rows", format: "integerFormat" },
];

const SETTLEMENT_FIELDS: AgFieldDefinition[] = [
  { id: "ref", name: "Ref", format: "textFormat" },
  { id: "bountyId", name: "Bounty", format: "textFormat" },
  { id: "payoutBatchId", name: "Payout batch", format: "textFormat" },
  {
    id: "amountDollars",
    name: "Amount",
    format: "currencyFormat",
    formatOptions: { format: "$#,##0.00" },
  },
  { id: "status", name: "Status", format: "textFormat" },
  { id: "created", name: "Created", format: "dateFormat" },
];

/** Browser adapter: relays the turn to our server-side /api/ai/chat (key never ships). */
function createRelayAdapter(): AgLlmAdapter {
  return {
    executeTurn(request, options) {
      const ctrl = new AbortController();
      options?.signal?.addEventListener("abort", () => ctrl.abort());
      let resolveComplete!: (v: AgLlmResponse) => void;
      const complete = new Promise<AgLlmResponse>((res) => {
        resolveComplete = res;
      });
      const fail = (message: string) =>
        resolveComplete({
          id: `turn-${Date.now().toString(36)}`,
          createdAt: Date.now(),
          status: "failed",
          error: { message } as AgLlmResponse["error"],
          output: [],
          usage: { inputTokens: 0, outputTokens: 0 },
        });
      async function* gen(): AsyncGenerator<AgAiEvent> {
        let res: Response;
        try {
          res = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: request.input,
              instructions: request.instructions,
              tools: request.tools,
              toolChoice: request.toolChoice,
              responseFormat: request.responseFormat,
              model: (request as unknown as { model?: unknown }).model,
            }),
            signal: ctrl.signal,
          });
        } catch (e) {
          fail(`AI relay unreachable: ${(e as Error).message}`);
          return;
        }
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          fail(data.error || `AI relay HTTP ${res.status}`);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let text = "";
        const toolCalls: Array<{ callId: string; name: string; args: string }> =
          [];
        const findTool = (callId: string) =>
          toolCalls.find((t) => t.callId === callId);
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              const t = line.trim();
              if (!t) continue;
              let ev: AgAiEvent;
              try {
                ev = JSON.parse(t) as AgAiEvent;
              } catch {
                continue;
              }
              yield ev;
              if (
                ev.type === "TEXT_MESSAGE_CHUNK" &&
                "delta" in ev &&
                typeof ev.delta === "string"
              ) {
                text += ev.delta;
              } else if (ev.type === "TOOL_CALL_CHUNK") {
                const chunk = ev as unknown as {
                  toolCallId?: string;
                  toolCallName?: string;
                  delta?: string;
                };
                if (chunk.toolCallId && !findTool(chunk.toolCallId)) {
                  toolCalls.push({
                    callId: chunk.toolCallId,
                    name: chunk.toolCallName || "tool",
                    args: "",
                  });
                }
                const tool = chunk.toolCallId
                  ? findTool(chunk.toolCallId)
                  : undefined;
                if (tool) {
                  if (chunk.toolCallName) tool.name = chunk.toolCallName;
                  if (typeof chunk.delta === "string") tool.args += chunk.delta;
                }
              }
            }
          }
        } finally {
          try {
            reader.releaseLock();
          } catch {
            // already released
          }
        }
        const msgId = `msg-${Date.now().toString(36)}`;
        resolveComplete({
          id: `turn-${Date.now().toString(36)}`,
          createdAt: Date.now(),
          status: "completed",
          output: [
            ...(text
              ? [
                  {
                    id: msgId,
                    kind: "output" as const,
                    type: "message" as const,
                    role: "assistant" as const,
                    status: "completed" as const,
                    content: [{ type: "text" as const, text, annotations: [] }],
                  },
                ]
              : []),
            ...toolCalls.map((t) => ({
              id: `tc-${t.callId}`,
              kind: "output" as const,
              type: "function_call" as const,
              callId: t.callId,
              name: t.name,
              arguments: t.args || "{}",
              status: "completed" as const,
            })),
          ],
          usage: { inputTokens: 0, outputTokens: 0 },
        });
      }
      return { stream: { [Symbol.asyncIterator]: gen }, complete };
    },
  };
}

const AI_MODELS: AgAiModel[] = [{ id: "escrow-model", label: "Escrow model" }];

const PROMPT_STARTERS: AgAiPromptStarter[] = [
  {
    label: "Summarise escrow",
    prompt:
      "Summarise this escrow report: totals, statuses, and anything that stands out.",
  },
  {
    label: "Unsettled payouts",
    prompt:
      "Which bounties have unsettled, pending or failed developer payouts?",
  },
  {
    label: "Flag anomalies",
    prompt:
      "Flag anything anomalous: failed payouts, refunds, or payouts that never sent.",
  },
];

export function AuditScreen({ bounties, theme }: AuditScreenProps) {
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const aegisTheme = useMemo(() => buildAegisTheme(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settlements");
        if (!res.ok) return;
        const data = (await res.json()) as SettlementRow[];
        if (!cancelled) setSettlements(data);
      } catch {
        // audit grid falls back to bounty-derived rows
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Content signatures: the dashboard polls every 10s with fresh array identities.
  // Rebuilding `data` on reference change resets Studio; rebuild only when rows change.
  const bountySig = JSON.stringify(
    bounties.map((b) =>
      [
        b.id,
        b.title,
        b.status,
        b.category,
        b.escrowAmount,
        b.platformFee ?? "",
        b.developerPayout ?? "",
        b.payoutStatus ?? "",
        b.invoiceStatus ?? "",
        b.claimCount ?? 0,
      ].join("|")
    )
  );
  const settlementSig = JSON.stringify(
    settlements.map((s) =>
      [
        s.id,
        s.bountyId,
        s.payoutBatchId ?? "",
        s.amount,
        s.status,
        s.createdAt,
      ].join("|")
    )
  );

  const data = useMemo(() => {
    const open = bounties.filter(
      (b) => b.status !== "SETTLED" && b.status !== "REFUNDED"
    );
    const closed = bounties.filter((b) => b.status === "SETTLED");
    const row = (b: Bounty) => ({
      ref: b.id.length > 8 ? `${b.id.slice(0, 8)}…` : b.id,
      title: b.title,
      status: b.status,
      category: b.category,
      escrowAmount: b.escrowAmount,
      platformFee:
        b.platformFee ?? Math.round(b.escrowAmount * 0.05 * 100) / 100,
      developerPayout:
        b.developerPayout ?? Math.round(b.escrowAmount * 0.95 * 100) / 100,
      payoutStatus: b.payoutStatus || "—",
      invoiceStatus: b.invoiceStatus || "—",
      claimCount: b.claimCount ?? 0,
      rowCount: 1,
    });
    return {
      sources: [
        {
          id: "escrow-open",
          name: "Open escrow",
          data: open.map(row),
          fields: ESCROW_FIELDS,
        },
        {
          id: "escrow-closed",
          name: "Closed escrow",
          data: closed.map(row),
          fields: ESCROW_FIELDS,
        },
        {
          id: "settlements",
          name: "Settlements",
          data: settlements.map((s) => ({
            ref: s.id.length > 8 ? `${s.id.slice(0, 8)}…` : s.id,
            bountyId: s.bountyId,
            payoutBatchId: s.payoutBatchId || "—",
            amountDollars: Math.round(s.amount) / 100,
            status: s.status,
            created: new Date(s.createdAt).toISOString().slice(0, 10),
          })),
          fields: SETTLEMENT_FIELDS,
        },
      ],
    };
  }, [bountySig, settlementSig]);

  // Finding line: computed from the same rows the canvas shows, so copies agree.
  const finding = useMemo(() => {
    const open = bounties.filter(
      (b) => b.status !== "SETTLED" && b.status !== "REFUNDED"
    );
    const closed = bounties.filter((b) => b.status === "SETTLED");
    const locked = open.reduce((t, b) => t + b.escrowAmount, 0);
    const paid = closed.reduce(
      (t, b) =>
        t +
        (b.developerPayout ?? Math.round(b.escrowAmount * 0.95 * 100) / 100),
      0
    );
    const attention = bounties.filter((b) => {
      if (b.status !== "SETTLED") return (b.claimCount ?? 0) > 0;
      const ps = (b.payoutStatus || "").toUpperCase();
      return !ps || ps === "—" || /FAIL|SKIP|PEND/.test(ps);
    }).length;
    if (bounties.length === 0)
      return "No escrow activity yet — post a bounty to open the ledger.";
    const bits = [`${money(locked)} locked`, `${money(paid)} paid out`];
    if (attention > 0) bits.push(`${attention} needing attention`);
    return bits.join(" · ");
  }, [bounties]);

  const initialState = useMemo<AgReportState>(
    () => ({
      pages: [
        {
          id: "overview",
          widgets: {
            "kpi-locked": {
              type: "value",
              dataMapping: {
                value: [{ id: "escrow-open.escrowAmount", aggregation: "sum" }],
              },
              format: { caption: { enabled: true, text: "Locked escrow" } },
            },
            "kpi-paid": {
              type: "value",
              dataMapping: {
                value: [
                  { id: "escrow-closed.developerPayout", aggregation: "sum" },
                ],
              },
              format: { caption: { enabled: true, text: "Developer payouts" } },
            },
            grid: {
              type: "grid",
              dataMapping: {
                cols: [
                  { id: "escrow-open.ref" },
                  { id: "escrow-open.title" },
                  { id: "escrow-open.status" },
                  { id: "escrow-open.escrowAmount" },
                  { id: "escrow-open.payoutStatus" },
                ],
              },
              format: { title: { enabled: true, text: "Open escrow" } },
            },
            chart: {
              type: "column-chart-grouped",
              dataMapping: {
                categoryKey: [{ id: "escrow-open.status" }],
                valueKey: [
                  { id: "escrow-open.escrowAmount", aggregation: "sum" },
                ],
              },
              format: {
                title: { enabled: true, text: "Open escrow by status" },
              },
            },
          },
          widgetLayout: {
            "kpi-locked": { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 8 },
            "kpi-paid": { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 8 },
            chart: { xTrack: 0, yTrack: 8, xSpan: 24, ySpan: 14 },
            grid: { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 20 },
          },
          selection: { type: "widget", id: "grid" },
        },
      ],
      selectedPageId: "overview",
      panels: { filters: { collapsed: false }, data: { collapsed: true } },
    }),
    []
  );

  const adapter = useMemo(() => createRelayAdapter(), []);
  const ai = useMemo<AgAiHarnessSetup>(
    () =>
      ({ api }) =>
        createAiHarness(api, ({ builtIn, tools }) => ({
          agents: [
            ...Object.values(builtIn).map((d) =>
              directLlmRunner({ ...d, adapter })
            ),
            directLlmRunner({
              id: "escrow-auditor",
              adapter,
              description:
                "Audits Aegis-402 escrow: flags failed payouts, stuck bounties, and refund anomalies.",
              schema: (s) => s.undefined(),
              instructions: () =>
                "You audit Aegis-402 PayPal escrow. Use view_schema once, then execute_query for specifics. Flag failed or pending developer payouts, refunded bounties, and anything anomalous. When asked, add a widget showing the answer.",
              tools: () => [
                tools.studio.executeQuery(),
                tools.studio.viewSchema(),
              ],
            }),
          ],
          primary: "lead",
          models: AI_MODELS,
          promptStarters: PROMPT_STARTERS,
        })),
    [adapter]
  );

  return (
    <div className="px-4 lg:px-6 space-y-4">
      <div className="pb-3 border-b border-border">
        <h1 className="text-xl font-medium text-foreground tracking-tight">
          Escrow audit
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">
          {finding}
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <div
          className="ag-theme-mode h-[calc(100vh-280px)] min-h-140 w-full"
          data-ag-theme-mode={theme}
        >
          <AgStudioProvider licenseKey={LICENSE_KEY} modules={STUDIO_MODULES}>
            <AgStudio
              style={STUDIO_STYLE}
              data={data}
              theme={aegisTheme}
              initialState={initialState}
              mode="view"
              ai={ai}
            />
          </AgStudioProvider>
        </div>
      </Card>
    </div>
  );
}
