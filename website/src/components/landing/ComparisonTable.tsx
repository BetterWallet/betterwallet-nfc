import { comparisonColumns, comparisonRows } from "@/lib/copy";
import { SectionReveal } from "./SectionReveal";

function renderCell(value: string, isBetterWallet: boolean) {
  if (value === "yes") return <span className="text-lg text-[var(--accent)]">✓</span>;
  if (value === "x") return <span className="text-lg text-[var(--danger)]">✕</span>;
  if (value === "partial") return <span>partial ●</span>;
  if (value === "NFC" || value === "QR" || value === "DIY") {
    return (
      <span>
        {value} {isBetterWallet ? "✓" : ""}
      </span>
    );
  }
  return <span>{value}</span>;
}

export function ComparisonTable() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-6 py-20" delay={0.12}>
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How it compares</h2>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--border)] px-4 py-3 font-mono text-xs text-[var(--muted)]">
                Feature
              </th>
              {comparisonColumns.map((column) => (
                <th
                  key={column}
                  className={`border-b border-l border-[var(--border)] px-4 py-3 ${
                    column === "Better Wallet" ? "text-[var(--accent)]" : ""
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.label} className="align-top">
                <td className="border-b border-[var(--border)] px-4 py-3 font-semibold">{row.label}</td>
                {row.values.map((value, index) => {
                  const isBetterWallet = index === row.values.length - 1;
                  return (
                    <td
                      key={`${row.label}-${index}`}
                      className={`border-b border-l border-[var(--border)] px-4 py-3 text-[var(--muted)] ${
                        isBetterWallet ? "font-semibold text-[var(--foreground)]" : ""
                      }`}
                    >
                      {renderCell(value, isBetterWallet)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionReveal>
  );
}
