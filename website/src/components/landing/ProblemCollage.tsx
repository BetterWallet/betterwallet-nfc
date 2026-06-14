import Image from "next/image";
import { SectionReveal } from "./SectionReveal";

export function ProblemCollage() {
  return (
    <SectionReveal id="why" className="mx-auto w-full max-w-6xl px-6 py-20" delay={0.05}>
      <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">
        Why Better Wallet
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        The current wallet landscape keeps failing users
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Image
            src="/images/problem-collage.png"
            alt="News and social posts describing wallet attacks"
            width={1024}
            height={576}
            className="h-44 w-full rounded-xl object-cover"
          />
          <p className="mt-3 font-mono text-xs text-[var(--accent)]">Real incidents</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Fake apps, spoofed hardware, and phishing still exploit trust at the signing step.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <blockquote className="rounded-xl border border-[var(--border)] bg-black/30 p-4 font-mono text-sm text-[var(--foreground)]">
            “Blind signing turns every transaction into a leap of faith.”
          </blockquote>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Better Wallet makes intent legible before approval: function, dApp, contract, and risk
            level are shown on-device.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Image
            src="/images/comparison-table.png"
            alt="Reference comparison table between wallet devices"
            width={1024}
            height={576}
            className="h-44 w-full rounded-xl object-cover"
          />
          <p className="mt-3 text-sm text-[var(--muted)]">
            Commercial options optimize convenience. This project optimizes auditable custody.
          </p>
        </article>
      </div>
    </SectionReveal>
  );
}
