import { LogoMark } from "./LogoMark";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <LogoMark size={26} className="rounded-md" />
          <p className="text-sm text-[var(--muted)]">
            Built because custody should not require blind trust.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
            href="https://github.com/BetterWallet/betterwallet-nfc"
          >
            GitHub
          </a>
          <a className="text-[var(--muted)] hover:text-[var(--foreground)]" href="#build">
            Docs
          </a>
          <span className="text-[var(--muted)]">ETH NYC 2026</span>
        </div>
      </div>
    </footer>
  );
}
