import { timeline } from "@/lib/copy";
import { SectionReveal } from "./SectionReveal";

export function OriginStory() {
  return (
    <SectionReveal id="story" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">Story</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            How I landed on a DIY hardware wallet
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            This started as a personal response to a real loss. I first built Better Wallet during
            ETH Online 2025, where we won second place using an old phone as both an offline hot and
            offline cold wallet. We then reused and improved the project at Stellar Builder Garage
            and won first place with hardware plus QR-code signing. We then won second place at the
            Solana Colosseum Network State Bounty before ETHGlobal New York 2026, where we revamped
            and rearchitected the entire hardware stack to build NFC and make UI and UX flows better.
            We created a new app from scratch that supports cross-chain, EVM, and Solana.
          </p>
        </div>

        <ol className="space-y-3">
          {timeline.map((item, index) => (
            <li key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="font-mono text-xs text-[var(--accent)]">0{index + 1}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </SectionReveal>
  );
}
