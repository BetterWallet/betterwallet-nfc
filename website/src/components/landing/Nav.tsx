import { navItems } from "@/lib/copy";
import { LogoMark } from "./LogoMark";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color:color-mix(in_oklab,var(--background)_88%,black)]/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
          <LogoMark size={30} className="rounded-md" />
          <span>
            Better <span className="font-mono text-[var(--accent)]">Wallet</span>
          </span>
        </a>
        <div className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none"
            >
              {item.label}
            </a>
          ))}
        </div>
        <a
          href="#build"
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none"
        >
          Build yours
        </a>
      </nav>
    </header>
  );
}
