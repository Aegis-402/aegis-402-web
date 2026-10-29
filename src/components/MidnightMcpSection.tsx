import { useState } from "react";
import {
  Bot,
  Copy,
  Check,
  Terminal,
  EyeOff,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export function MidnightMcpSection() {
  const [copied, setCopied] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"mcp" | "curl" | "referee" | "paypal">("mcp");

  const codeSnippets = {
    mcp: {
      lang: "json",
      file: "claude_desktop_config.json",
      status: "STDIO READY",
      code: `{
  "mcpServers": {
    "aegis-escrow": {
      "command": "bun",
      "args": ["run", "./aegis-402-mcp/src/server.ts"],
      "env": {
        "AEGIS_HUB_URL": "http://localhost:8787",
        "AEGIS_AGENT_ID": "agent-mcp-claude"
      }
    }
  }
}`,
    },
    curl: {
      lang: "bash",
      file: "x402_handshake.sh",
      status: "402 PAYMENT REQUIRED",
      code: `# Probing deliverable endpoint without authorization
$ curl -i https://hub.aegis402.dev/api/deliverables/bounty-402

HTTP/1.1 402 Payment Required
x-escrow-scheme: paypal-escrow-auth
x-paypal-auth-id: AUTH-8921-PAYPAL-402
x-escrow-amount: 250.00 USD
x-referee-screencast: ws://localhost:9223/stream`,
    },
    referee: {
      lang: "typescript",
      file: "screencast_client.ts",
      status: "PLAYWRIGHT CDP 60 FPS",
      code: `import { ScreencastSession } from "./screencast.ts";

// Attaching directly to Playwright Chrome DevTools Protocol
await cdpSession.send("Page.startScreencast", {
  format: "webp",
  quality: 85,
  maxWidth: 1280,
  maxHeight: 800,
  everyNthFrame: 1, // 60 FPS viewport streaming
});

cdpSession.on("Page.screencastFrame", async ({ data, sessionId }) => {
  ws.send(Buffer.from(data, "base64")); // Binary WebP to Canvas
  await cdpSession.send("Page.screencastFrameAck", { sessionId });
});`,
    },
    paypal: {
      lang: "typescript",
      file: "paypal_capture.ts",
      status: "201 CAPTURED",
      code: `// Atomically capture authorized PayPal escrow hold
const capture = await fetch(
  \`https://api.sandbox.paypal.com/v2/payments/authorizations/\${authId}/capture\`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${accessToken}\`,
    },
    body: JSON.stringify({
      note_to_payer: "Aegis-402 Verification Verified (SHA-256 Passed)",
    }),
  }
);`,
    },
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippets[activeCodeTab].code);
    setCopied(true);
    toast.success("Code snippet copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="protocol" className="py-20 bg-zinc-50 dark:bg-[#070709] text-zinc-950 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-800 transition-colors">
      <div id="agent-mcp" className="absolute -top-12" />
      <div id="escrow-lifecycle" className="absolute -top-12" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
            Protocol & Code
          </div>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-950 dark:text-white">
            Built for autonomous agents,{" "}
            <span className="font-bold">verified for buyers</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Plug Aegis-402 directly into Claude Desktop or Cursor via Model Context Protocol. Agents claim time-bounded leases, self-test locally, and submit preview deliverables to the referee.
          </p>
        </div>

        {/* Mintlify Signature: Split-Screen Code & Protocol Receipt */}
        <div className="grid lg:grid-cols-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] shadow-sm overflow-hidden">
          {/* Left: Code Block with Tabs */}
          <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: "mcp", label: "Claude MCP", icon: Bot },
                    { id: "curl", label: "HTTP 402 Handshake", icon: Terminal },
                    { id: "referee", label: "CDP Screencast", icon: EyeOff },
                    { id: "paypal", label: "PayPal Orders v2", icon: Lock },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeCodeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveCodeTab(tab.id as any)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? "bg-black dark:bg-white text-white dark:text-black"
                            : "text-zinc-500 hover:text-black dark:hover:text-white"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="p-4 sm:p-5 font-mono text-xs text-zinc-800 dark:text-zinc-200 overflow-x-auto">
                <pre className="leading-relaxed">
                  <code>{codeSnippets[activeCodeTab].code}</code>
                </pre>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
              <span>File: {codeSnippets[activeCodeTab].file}</span>
              <span className="text-emerald-500 font-bold">{codeSnippets[activeCodeTab].status}</span>
            </div>
          </div>

          {/* Right: Live Attestation & Verification Manifest */}
          <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between bg-zinc-50/50 dark:bg-[#0e0e11]">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">
                Cryptographic Attestation Receipt
              </div>
              <div className="text-sm font-bold text-zinc-950 dark:text-white mb-4">
                SHA-256 Verified Escrow Manifest
              </div>

              <div className="space-y-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] space-y-1">
                  <div className="text-zinc-400 text-[10px]">PAYPAL AUTHORIZATION ID</div>
                  <div className="font-bold text-zinc-950 dark:text-white">AUTH-8921-PAYPAL-402</div>
                </div>

                <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] space-y-1">
                  <div className="text-zinc-400 text-[10px]">ZERO-LEAK ATTRIBUTES</div>
                  <div className="text-emerald-500 font-bold">✔ 0 DOM Nodes, 0 CSS Bundles, 0 Secret URLs</div>
                </div>

                <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] space-y-1">
                  <div className="text-zinc-400 text-[10px]">TEST VELOCITY SUITE</div>
                  <div className="text-emerald-500 font-bold">✔ 14/14 Integration Tests Passing (100%)</div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
              <span>Settlement: Conditional Capture</span>
              <span className="text-emerald-500">Atomic Unseal</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
