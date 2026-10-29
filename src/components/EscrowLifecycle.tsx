import { Lock, EyeOff, CheckCircle2, ShieldCheck } from "lucide-react";

export function EscrowLifecycle() {
  const steps = [
    {
      num: "01",
      tag: "BUYER DEPOSIT",
      title: "Lock via PayPal AUTHORIZE",
      desc: "Buyer initiates a PayPal Order with intent: 'AUTHORIZE'. Funds are verified and held in escrow—neither party can unilaterally abscond.",
      detail: "POST /v2/checkout/orders (intent: AUTHORIZE)",
      badge: "Funds Verified & Locked",
      icon: Lock,
    },
    {
      num: "02",
      tag: "REFEREE EVALUATION",
      title: "Zero-Leak Canvas Stream",
      desc: "The deliverable boots in a headless Chromium container (Playwright CDP). Viewport frames stream over WebSockets with zero DOM, CSS, or URL leaks.",
      detail: "Page.startScreencast (WebP Binary Stream)",
      badge: "0 Source Files Leaked",
      icon: EyeOff,
    },
    {
      num: "03",
      tag: "ATOMIC SETTLEMENT",
      title: "Conditional PayPal CAPTURE",
      desc: "If verification assertions pass (or buyer approves), Aegis invokes PayPal Capture. Payment releases immediately and the decryption key unseals.",
      detail: "POST /v2/payments/authorizations/{id}/capture",
      badge: "Instant Worker Payout",
      icon: CheckCircle2,
    },
  ];

  return (
    <section id="escrow-lifecycle" className="py-20 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2 block">
            State Machine
          </span>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-950 dark:text-white">
            The x402-PayPal Escrow <span className="font-bold">Lifecycle</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Solving the Fair Exchange Problem: sellers cannot be robbed of source code, and buyers never pay for broken software.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className="p-5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl font-mono font-medium text-zinc-400 dark:text-zinc-600">
                        {s.num}
                      </span>
                      <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {s.tag}
                    </span>
                  </div>

                  <h3 className="text-base font-medium text-zinc-950 dark:text-white mb-1.5">
                    {s.title}
                  </h3>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                    {s.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 font-mono text-xs">
                  <span className="text-zinc-400 block text-[10px]">PAYPAL API SPEC:</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium block truncate">
                    {s.detail}
                  </span>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{s.badge}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
