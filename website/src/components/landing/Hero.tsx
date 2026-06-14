import Image from "next/image";
import { LogoMark } from "./LogoMark";
import { SectionReveal } from "./SectionReveal";

export function Hero() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-6 pb-20 pt-14">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="md:pr-4">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-mono text-xs text-[var(--muted)]">
          <LogoMark size={18} className="rounded-sm" />
          OPEN SOURCE · OFFLINE · CLEAR SIGNING
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-6xl">
            Sign what you see.
            <span className="block text-[var(--accent)]">Not what you hope.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--muted)] md:text-lg">
            My friend got hacked and lost his crypto. I built Better Wallet to solve that personal
            self custody: fully offline custody, Clear signing, and a DIY build anyone technical can
            audit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#build"
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-foreground)]"
            >
              Start building
            </a>
            <a
              href="#why"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)]"
            >
              See why this exists
            </a>
          </div>
        </div>

        <div className="flex h-[360px] gap-3">
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <Image
              src="/images/device-review-swap.jpg"
              alt="Better Wallet hardware prototype showing clear-signing confirmation screen"
              fill
              className="object-cover"
            />
          </div>

          <div className="flex w-[140px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-black/40">
            <div className="relative flex-1 overflow-hidden">
              <video
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Better Wallet short reel"
              >
                <source src="/videos/IMG_3090.mp4" type="video/mp4" />
                <source src="/videos/IMG_3090.MOV" type="video/quicktime" />
                Your browser does not support embedded video playback.
              </video>
            </div>
            <p className="border-t border-[var(--border)] px-3 py-2 text-center font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
              live reel
            </p>
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}
