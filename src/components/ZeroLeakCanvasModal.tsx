import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { Bounty } from "../types";
import { ZeroLeakCanvasViewer } from "./ZeroLeakCanvasViewer";

interface ZeroLeakCanvasModalProps {
  bounty: Bounty | null;
  isOpen: boolean;
  onClose: () => void;
  onSettled: (bountyId: string) => void;
  onRefunded: (bountyId: string) => void;
}

export function ZeroLeakCanvasModal({
  bounty,
  isOpen,
  onClose,
  onSettled,
  onRefunded,
}: ZeroLeakCanvasModalProps) {
  if (!isOpen || !bounty) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative w-full h-full flex flex-col"
        >
          <button
            onClick={onClose}
            aria-label="Close reviewer"
            className="absolute top-2 right-2 z-20 size-7 rounded border border-border bg-card hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
          </button>

          <ZeroLeakCanvasViewer
            bounty={bounty}
            fill
            onSettled={onSettled}
            onRefunded={(id) => {
              onRefunded(id);
              onClose();
            }}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
