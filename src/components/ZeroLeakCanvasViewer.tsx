import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Lock,
  RefreshCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { Bounty } from "../types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const ARBITER_WS_URL = "wss://aegis-arbiter.ayiba.dev/screencast";

interface ZeroLeakCanvasViewerProps {
  bounty: Bounty;
  onSettled?: (bountyId: string) => void;
  onRefunded?: (bountyId: string) => void;
  /** Fill the parent's height instead of using a fixed viewport height. */
  fill?: boolean;
  /** Hide the approve/void toolbar (settlement handled by the parent). */
  hideSettlement?: boolean;
}

type Status = "connecting" | "starting" | "live" | "error" | "closed";

const clampDim = (n: number) => Math.min(4096, Math.max(200, Math.round(n)));
const getDsf = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));

export function ZeroLeakCanvasViewer({
  bounty,
  onSettled,
  onRefunded,
  fill = false,
  hideSettlement = false,
}: ZeroLeakCanvasViewerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef(`viewer-${Math.random().toString(36).slice(2, 9)}`);
  // Remote viewport size in CSS px (what pointer coordinates must map to)
  const remoteSizeRef = useRef({ w: 1280, h: 800 });

  const [status, setStatus] = useState<Status>("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Arbiter WS endpoint: served by /api/public-config (wrangler ARBITER_WS_URL),
  // with the VM default until config loads or if the fetch fails.
  const [wsUrl, setWsUrl] = useState<string>(ARBITER_WS_URL);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.arbiterWsUrl === "string" && d.arbiterWsUrl) {
          setWsUrl(d.arbiterWsUrl);
        }
      })
      .catch(() => {
        // offline preview etc. — stay on the default
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [busy, setBusy] = useState<"capture" | "void" | null>(null);
  const [receipt, setReceipt] = useState<{ captureId: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ id: clientIdRef.current, ...payload }));
    }
  }, []);

  // Connection lifecycle: opens when mounted, closes when unmounted.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    setStatus("connecting");
    setErrorMsg("");
    setFrameSize(null);

    const rect = stage.getBoundingClientRect();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    let disposed = false;

    ws.onopen = () => {
      setStatus("starting");
      const w = clampDim(rect.width);
      const h = clampDim(rect.height);
      remoteSizeRef.current = { w, h };
      ws.send(
        JSON.stringify({
          type: "viewer-ready",
          id: clientIdRef.current,
          bountyId: bounty.id,
          screenWidth: w,
          screenHeight: h,
          deviceScaleFactor: getDsf(),
          devUrl: bounty.deliverableUrl || undefined,
        })
      );
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const raw = event.data;
      if (raw.startsWith("{")) {
        try {
          const packet = JSON.parse(raw);
          if (packet.type === "session-ready") setStatus("live");
          else if (packet.type === "session-error") {
            setStatus("error");
            setErrorMsg(packet.error || "Session failed to start.");
          } else if (packet.type === "error") {
            setStatus("error");
            setErrorMsg(packet.message || "Arbiter error.");
          }
          return;
        } catch {
          // not JSON, treat as frame
        }
      }
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !ctx) return;
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
          setFrameSize({ w: img.width, h: img.height });
        }
        ctx.drawImage(img, 0, 0);
        setStatus("live");
      };
      img.src = `data:image/jpeg;base64,${raw}`;
    };

    ws.onerror = () => {
      if (disposed) return;
      setStatus("error");
      setErrorMsg(`Cannot reach the arbiter at ${wsUrl}. Is it running?`);
    };
    ws.onclose = () => {
      if (disposed) return;
      setStatus((s) => (s === "error" ? s : "closed"));
    };

    return () => {
      disposed = true;
      ws.close();
      wsRef.current = null;
    };
  }, [bounty.id, bounty.deliverableUrl, attempt, wsUrl]);

  // Keep the remote viewport matched to the on-screen stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const r = stage.getBoundingClientRect();
        const w = clampDim(r.width);
        const h = clampDim(r.height);
        remoteSizeRef.current = { w, h };
        send({
          type: "resize",
          screenWidth: w,
          screenHeight: h,
          deviceScaleFactor: getDsf(),
        });
      }, 150);
    });
    observer.observe(stage);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [send]);

  // Wheel must be a non-passive listener so the page doesn't scroll underneath.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toRemote(canvas, e.clientX, e.clientY, remoteSizeRef.current);
      send({
        type: "wheel",
        ...p,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        ...mods(e),
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [send]);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen();
  };

  const lastMove = useRef(0);

  const settle = async (action: "capture" | "void") => {
    if (
      action === "void" &&
      !confirm(`Void the authorization and refund $${bounty.escrowAmount.toFixed(2)} USD?`)
    )
      return;
    setBusy(action);
    try {
      const res = await fetch(`/api/bounties/${bounty.id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (action === "capture") {
        const data = (await res.json()) as { payPalCaptureId?: string; decryptionKey?: string };
        setReceipt({
          captureId: data.payPalCaptureId || "unknown",
          key: data.decryptionKey || "",
        });
        onSettled?.(bounty.id);
        toast.success(`Escrow captured: $${bounty.escrowAmount.toFixed(2)} USD released.`);
      } else {
        onRefunded?.(bounty.id);
        toast.info("Authorization voided. Escrow refunded.");
      }
    } catch {
      toast.error(action === "capture" ? "Failed to capture escrow." : "Failed to void escrow.");
    } finally {
      setBusy(null);
    }
  };

  const statusLabel: Record<Status, string> = {
    connecting: "Connecting…",
    starting: "Starting sandbox…",
    live: "Live sandbox",
    error: "Error",
    closed: "Disconnected",
  };

  return (
    <div
      ref={rootRef}
      className={`w-full flex flex-col rounded-md border border-border bg-card text-foreground overflow-hidden ${
        fill || isFullscreen ? "h-full" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0 text-sm">
          <ShieldCheck className="size-3.5 shrink-0" />
          <span className="font-medium truncate">{bounty.title}</span>
          <span className="font-mono text-muted-foreground hidden sm:inline">
            {bounty.id}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${
                status === "live"
                  ? "bg-emerald-500 animate-pulse"
                  : status === "error"
                  ? "bg-red-500"
                  : "bg-muted-foreground/50"
              }`}
            />
            {statusLabel[status]}
            {frameSize && status === "live" && (
              <span className="font-mono">
                {frameSize.w}×{frameSize.h}
              </span>
            )}
          </span>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="h-7 px-2 text-sm">
            {isFullscreen ? (
              <Minimize2 className="size-3 mr-1" />
            ) : (
              <Maximize2 className="size-3 mr-1" />
            )}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </Button>
        </div>
      </div>

      {/* Stage: the remote viewport is sized to exactly this box */}
      <div
        ref={stageRef}
        className={`relative bg-muted/40 ${
          fill || isFullscreen ? "flex-1 min-h-0" : "h-[70vh] min-h-[420px]"
        }`}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className="block w-full h-full outline-none cursor-default"
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            e.currentTarget.focus();
            const p = toRemote(e.currentTarget, e.clientX, e.clientY, remoteSizeRef.current);
            send({
              type: "click",
              ...p,
              button: e.button === 2 ? "right" : e.button === 1 ? "middle" : "left",
              clickCount: 1,
              ...mods(e),
            });
          }}
          onMouseMove={(e) => {
            const now = performance.now();
            if (now - lastMove.current < 25) return;
            lastMove.current = now;
            const p = toRemote(e.currentTarget, e.clientX, e.clientY, remoteSizeRef.current);
            send({ type: "mousemove", ...p, buttons: e.buttons, ...mods(e) });
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") return;
            e.preventDefault();
            send({
              type: "keydown",
              key: e.key,
              code: e.code,
              text: e.key.length === 1 ? e.key : undefined,
              ...mods(e),
            });
            // Printable characters need a follow-up char event for CDP to insert text.
            if (e.key.length === 1) {
              send({ type: "keypress", key: e.key, char: e.key, ...mods(e) });
            }
          }}
          onKeyUp={(e) => {
            e.preventDefault();
            send({ type: "keyup", key: e.key, code: e.code, ...mods(e) });
          }}
        />

        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 text-center p-6">
            {status === "error" || status === "closed" ? (
              <>
                <p className="text-sm font-medium">
                  {status === "error" ? "Preview unavailable" : "Preview disconnected"}
                </p>
                {errorMsg && (
                  <p className="text-sm text-muted-foreground max-w-md">{errorMsg}</p>
                )}
                <Button size="sm" variant="outline" onClick={() => setAttempt((a) => a + 1)} className="text-sm">
                  <RefreshCw className="size-3 mr-1" />
                  <span>Retry</span>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="size-3 animate-spin" />
                {statusLabel[status]}
              </p>
            )}
          </div>
        )}

        {receipt && (
          <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center p-6 text-center gap-3">
            <CheckCircle2 className="size-8 text-emerald-500" />
            <h4 className="text-base font-medium">Payment approved &amp; escrow released</h4>
            <div className="text-sm space-y-2 w-full max-w-md text-left rounded-md border border-border p-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">PayPal Capture ID</span>
                <span className="font-mono">{receipt.captureId}</span>
              </div>
              {receipt.key && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Signed download</span>
                  <span className="flex items-center gap-2 font-mono">
                    {receipt.key}
                    <button
                      className="p-1 rounded hover:bg-muted cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(receipt.key);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    </button>
                  </span>
                </div>
              )}
              {!receipt.key && (
                <p className="text-muted-foreground">
                  Sealed vault unlocked — pull it from Downloads.
                </p>
              )}
            </div>
            <Badge variant="emerald" className="text-sm">
              Settled &amp; archived
            </Badge>
          </div>
        )}
      </div>

      {!hideSettlement && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-3.5 text-[#0070ba]" />
            <span>
              <strong className="font-mono text-foreground">
                ${bounty.escrowAmount.toFixed(2)} USD
              </strong>{" "}
              locked in PayPal escrow
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null || bounty.status === "SETTLED"}
              onClick={() => settle("void")}
              className="flex-1 sm:flex-initial text-sm"
            >
              Reject &amp; Refund
            </Button>
            <Button
              size="sm"
              disabled={busy !== null || bounty.status === "SETTLED"}
              onClick={() => settle("capture")}
              className="flex-1 sm:flex-initial text-sm"
            >
              Approve &amp; Release ${bounty.escrowAmount.toFixed(2)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Map a pointer position to the remote viewport (stage == viewport size). */
function toRemote(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  size: { w: number; h: number }
) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * size.w,
    y: ((clientY - r.top) / r.height) * size.h,
  };
}

function mods(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
  return {
    altKey: e.altKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    shiftKey: e.shiftKey,
  };
}
