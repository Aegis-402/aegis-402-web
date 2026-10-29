import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface PostBountyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBountyCreated: (newBounty: any) => void;
}

export function PostBountyModal({ isOpen, onClose, onBountyCreated }: PostBountyModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("250");
  const [category, setCategory] = useState<"Web App" | "API / Backend" | "AI Agent Tool">("Web App");
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a bounty title");
      return;
    }

    setIsAuthorizing(true);
    // Simulate PayPal Checkout AUTHORIZATION step
    setTimeout(async () => {
      try {
        const authId = `AUTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}-PP`;
        const res = await fetch("/api/bounties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            escrowAmount: parseFloat(escrowAmount) || 250,
            category,
            payPalAuthorizationId: authId,
          }),
        });

        const created = await res.json();
        onBountyCreated(created);
        toast.success(`PayPal Escrow Authorized! $${escrowAmount}.00 USD locked in escrow.`);
        onClose();
        setTitle("");
        setDescription("");
      } catch {
        toast.error("Failed to post bounty.");
      } finally {
        setIsAuthorizing(false);
      }
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="relative w-full max-w-lg rounded-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 text-zinc-900 dark:text-zinc-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/aegis-402-logo-black.svg" alt="Aegis-402" className="w-7 h-7 dark:hidden" />
                <img src="/aegis-402-logo-white.svg" alt="Aegis-402" className="w-7 h-7 hidden dark:block" />
              </div>
              <div>
                <h3 className="font-medium text-base text-zinc-950 dark:text-white tracking-tight">Post Bounty with PayPal Escrow</h3>
                <p className="text-xs text-zinc-500">Funds are locked via PayPal AUTHORIZE hold and released on review</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Bounty Title / Deliverable Goal
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Next.js Auth Flow with Webhooks"
                required
                className="w-full px-3.5 py-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Escrow Hold Amount ($USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-zinc-400 text-sm">$</span>
                  <input
                    type="number"
                    min="50"
                    step="25"
                    value={escrowAmount}
                    onChange={(e) => setEscrowAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-3.5 py-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                >
                  <option value="Web App">Web App (Canvas Stream)</option>
                  <option value="API / Backend">API / Backend</option>
                  <option value="AI Agent Tool">AI Agent Tool</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Specification & Acceptance Criteria
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe acceptance criteria, required tests, and expected deliverable behavior..."
                className="w-full px-3.5 py-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            {/* Escrow Guarantee Box */}
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <strong>Zero-Risk Escrow:</strong> Clicking authorize locks ${escrowAmount}.00 in your PayPal account. Funds are <em>never captured</em> until you personally inspect and test the running deliverable inside the zero-leak canvas reviewer.
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isAuthorizing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold text-sm shadow-md shadow-blue-500/15 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isAuthorizing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>
                {isAuthorizing ? "Authorizing with PayPal..." : `Authorize $${escrowAmount}.00 Escrow Hold`}
              </span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
