import { buildLinks, parts } from "@/config/parts";
import { SectionReveal } from "./SectionReveal";

export function PartsBom() {
  return (
    <SectionReveal id="parts" className="mx-auto w-full max-w-6xl px-6 py-20" delay={0.16}>
      <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">Parts & links</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Bill of materials</h2>
      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[var(--surface)]">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)]">Part</th>
              <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)]">Model</th>
              <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)]">Cost</th>
              <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)]">Link</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--foreground)]">{item.label}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{item.model}</td>
                <td className="px-4 py-3 text-[var(--foreground)]">{item.estimatedCost}</td>
                <td className="px-4 py-3">
                  <a
                    href={item.url}
                    aria-label={`Open purchase link for ${item.label}`}
                    className="text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    Buy {item.label}
                  </a>
                </td>
              </tr>
            ))}
            <tr className="border-t border-[var(--border)] bg-[var(--surface)]/40 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-[var(--muted)]">Complete build</td>
              <td className="px-4 py-3">$35</td>
              <td className="px-4 py-3 text-[var(--muted)]">Varies by source</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {buildLinks.map((link) => (
          <a
            key={link.label}
            href={link.url}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)]"
          >
            {link.label}
          </a>
        ))}
      </div>
    </SectionReveal>
  );
}
