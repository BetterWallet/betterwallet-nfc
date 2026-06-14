import { SectionReveal } from "./SectionReveal";

export function WalkthroughVideos() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-6 pb-16" delay={0.03}>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">Walkthrough videos</p>
        <p className="mt-2 text-sm text-[var(--muted)]">Full YouTube walkthrough.</p>

        <div className="mt-4 space-y-4">
          <figure className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/30">
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src="https://www.youtube-nocookie.com/embed/Gy297UV1cyo"
                title="Better Wallet YouTube walkthrough"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <figcaption className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
              Full YouTube walkthrough
            </figcaption>
          </figure>
        </div>
      </div>
    </SectionReveal>
  );
}
