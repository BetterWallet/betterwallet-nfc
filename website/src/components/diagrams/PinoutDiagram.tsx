const rows = [
  ["PN532 SDA", "GPIO6", "Pin 31", "I2C bus 3"],
  ["PN532 SCL", "GPIO7", "Pin 26", "I2C bus 3"],
  ["LCD MOSI", "GPIO10", "Pin 19", "SPI0"],
  ["LCD MISO", "GPIO9", "Pin 21", "SPI0"],
  ["LCD SCLK", "GPIO11", "Pin 23", "SPI0"],
  ["LCD CE0", "GPIO8", "Pin 24", "SPI0"],
  ["Touch SDA", "GPIO2", "Pin 3", "I2C bus 1"],
  ["Touch SCL", "GPIO3", "Pin 5", "I2C bus 1"],
];

export function PinoutDiagram() {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-lg font-semibold">GPIO pinout map</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Wiring reference from the Pi hardware doc used in the demo build.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse text-sm">
          <thead>
            <tr className="bg-black/20">
              <th className="border border-[var(--border)] px-3 py-2 text-left font-mono text-xs text-[var(--muted)]">
                Signal
              </th>
              <th className="border border-[var(--border)] px-3 py-2 text-left font-mono text-xs text-[var(--muted)]">
                GPIO
              </th>
              <th className="border border-[var(--border)] px-3 py-2 text-left font-mono text-xs text-[var(--muted)]">
                Pin
              </th>
              <th className="border border-[var(--border)] px-3 py-2 text-left font-mono text-xs text-[var(--muted)]">
                Bus
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((col) => (
                  <td key={col} className="border border-[var(--border)] px-3 py-2 font-mono text-xs">
                    {col}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
