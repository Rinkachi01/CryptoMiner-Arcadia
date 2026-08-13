"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { GameDropValue } from "./drop-types";

export function DropNotification({ dropAmount }: { dropAmount: GameDropValue }) {
  const [isVisible, setIsVisible] = useState(false);
  const qty = typeof dropAmount === "number" ? dropAmount : dropAmount?.quantity;

  useEffect(() => {
    if (qty && qty > 0) {
      const showTimer = setTimeout(() => setIsVisible(true), 0);
      const hideTimer = setTimeout(() => setIsVisible(false), 5000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
    const hideTimer = setTimeout(() => setIsVisible(false), 0);
    return () => clearTimeout(hideTimer);
  }, [qty]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed bottom-8 right-8 z-50 pointer-events-none"
        >
          <div className="bg-zinc-950/80 backdrop-blur-md border border-amber-500/30 text-amber-500 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.2)] flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap text-amber-500">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-500/80 mb-1">Bônus Aleatório Encontrado!</h4>
              <p className="text-2xl font-bold font-mono">+{qty} GH/s</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
