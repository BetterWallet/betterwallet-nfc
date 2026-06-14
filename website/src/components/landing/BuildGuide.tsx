"use client";

import { buildSteps } from "@/lib/copy";
import Image from "next/image";
import { useState } from "react";
import { SectionReveal } from "./SectionReveal";

export function BuildGuide() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  async function copyCommand(command: string, index: number) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedStep(index);
      setTimeout(() => setCopiedStep(null), 1200);
    } catch {
      setCopiedStep(null);
    }
  }

  return (
    <SectionReveal id="build" className="mx-auto w-full max-w-6xl px-6 py-20" delay={0.14}>
      <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">DIY Build</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Build Better Wallet in five steps
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        Verify the hardware connections, then follow the exact commands.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">
          Connection instructions
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm text-[var(--muted)]">This build has three hardware connections:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--foreground)]">
              <li>The screen is connected using pogo pins.</li>
              <li>The NFC module is connected in the diagram shown below.</li>
              <li>Use a dedicated 3.3V power rail with shared GND for stable operation.</li>
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Image
              src="/images/pi-stack-reference.png"
              alt="Raspberry Pi stacked on display module using pogo pins"
              width={1024}
              height={768}
              className="h-full w-full rounded-xl border border-[var(--border)] object-cover"
            />
            <Image
              src="/images/rpi-nfc-connection-diagram.png"
              alt="Raspberry Pi to NFC module connection diagram"
              width={1024}
              height={768}
              className="h-full w-full rounded-xl border border-[var(--border)] object-cover"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {buildSteps.map((step, index) => (
          <article
            key={step.title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <p className="font-mono text-xs text-[var(--accent)]">Step 0{index + 1}</p>
            <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{step.detail}</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-black/30 p-3">
              <code className="flex-1 overflow-x-auto font-mono text-xs text-[var(--foreground)]">
                {step.command}
              </code>
              <button
                onClick={() => copyCommand(step.command, index)}
                className="h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none"
              >
                {copiedStep === index ? "Copied" : "Copy"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </SectionReveal>
  );
}
