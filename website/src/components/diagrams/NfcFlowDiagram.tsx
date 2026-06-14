"use client";

import { motion, useReducedMotion } from "framer-motion";

const steps = [
  "Tap 1: Phone sends payload chunks",
  "Pi parses tx + shows clear signing",
  "User approves on device",
  "Tap 2: Pi sends signed transaction",
];

export function NfcFlowDiagram() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-lg font-semibold">Two-tap NFC signing flow</h3>
      <ol className="mt-4 grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <motion.li
            key={step}
            className="rounded-xl border border-[var(--border)] bg-black/30 p-3 text-sm text-[var(--foreground)]"
            initial={prefersReducedMotion ? false : { opacity: 0.5 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
          >
            <p className="font-mono text-xs text-[var(--accent)]">0{index + 1}</p>
            <p className="mt-1">{step}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
