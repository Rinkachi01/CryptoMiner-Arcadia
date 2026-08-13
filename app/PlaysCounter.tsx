"use client";

import { motion } from "framer-motion";

export function PlaysCounter({ remaining }: { remaining: number }) {
  return (
    <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl mb-6 shadow-inner">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-gamepad-2">
            <line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Partidas Restantes (24h)</span>
          <span className="text-xs text-zinc-500">Recarga gradual automática</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <motion.span 
          key={remaining}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-3xl font-mono font-bold ${remaining > 0 ? "text-zinc-100" : "text-red-400"}`}
        >
          {remaining}
        </motion.span>
      </div>
    </div>
  );
}
