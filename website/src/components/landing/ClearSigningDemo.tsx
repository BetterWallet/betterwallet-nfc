"use client";

import { useState } from "react";
import { SectionReveal } from "./SectionReveal";

export function ClearSigningDemo() {
  const [showClear, setShowClear] = useState(true);

  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-6 py-20" delay={0.08}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">
            Trust Boundary
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Clear signing instead of raw blind payloads
          </h2>
        </div>
        <button
          onClick={() => setShowClear((current) => !current)}
          aria-pressed={showClear}
          aria-label="Toggle clear signing preview"
          className="h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none"
        >
          {showClear ? "Switch to blind" : "Switch to clear"}
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-mono text-xs text-[var(--danger)]">Blind signing</p>
          <h3 className="mt-2 text-lg font-semibold">What users usually approve</h3>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-black/40 p-4 font-mono text-xs text-[var(--muted)]">
            0xb010...aa3f
            {"\n"}0x7f2d...991c
            {"\n"}0xe4f8...117d
            {"\n"}INPUT DATA (opaque)
          </pre>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-mono text-xs text-[var(--accent)]">Clear signing</p>
          <h3 className="mt-2 text-lg font-semibold">What Better Wallet shows</h3>
          <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-black/40 p-4 font-mono text-xs">
            {showClear ? (
              <>
                <p>Intent: Swap</p>
                <p>Function: execute(bytes,bytes[],uint256)</p>
                <p>dApp: Uniswap Labs</p>
                <p>Contract: 0x39D4...67599</p>
                <p className="text-[var(--accent)]">SECURITY LEVEL: HIGH</p>
              </>
            ) : (
              <p className="text-[var(--muted)]">Switch back to see parsed transaction intent.</p>
            )}
          </div>
        </article>
      </div>
    </SectionReveal>
  );
}
