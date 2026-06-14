"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const states = ["idle", "tap1", "signing", "tap2", "done"];

export function DeviceMockup() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative mx-auto w-[260px] rounded-[28px] border border-white/10 bg-black p-3 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
      {!prefersReducedMotion &&
        [0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            className="pointer-events-none absolute inset-0 rounded-[28px] border border-[var(--accent)]/40"
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 1.06, 1.12], opacity: [0, 0.4, 0] }}
            transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, delay: ring * 0.55 }}
          />
        ))}

      <div className="rounded-[20px] bg-[radial-gradient(circle_at_top,_rgba(78,255,145,0.24),_transparent_48%),_#101010] p-4">
        <p className="text-xl font-semibold text-[var(--foreground)]">Review Swap</p>
        <p className="text-xs tracking-wider text-[var(--muted)]">SECURITY LEVEL: HIGH</p>

        <div className="mt-3 space-y-1 rounded-xl border border-white/15 bg-white/5 p-3 font-mono text-[11px] text-[var(--foreground)]">
          <p>Intent: Swap</p>
          <p>Function: execute(bytes,bytes[],uint256)</p>
          <p>dApp: Uniswap Labs</p>
          <p>Deadline: 1781435850</p>
          <p>Contract: 0x39D4...67599</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="h-11 rounded-full bg-white/10 text-sm font-semibold text-[var(--foreground)]">
            Reject
          </button>
          <button className="h-11 rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-foreground)]">
            Accept
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <p className="font-semibold text-[var(--accent)]">BETTER WALLET</p>
          <div className="rounded-full border border-white/20 px-2 py-0.5 font-mono text-[var(--muted)]">
            {prefersReducedMotion ? "done" : <CycleState />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CycleState() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % states.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.span key={states[index]} className="inline-block">
      <motion.span
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {states[index]}
      </motion.span>
    </motion.span>
  );
}
