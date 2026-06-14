export function BlockDiagram() {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-lg font-semibold">Hardware block diagram</h3>
      <svg viewBox="0 0 720 300" className="mt-4 w-full" role="img" aria-label="Better Wallet hardware block diagram">
        <rect x="20" y="30" width="180" height="90" rx="12" fill="#131313" stroke="#2a2a2a" />
        <text x="110" y="70" fill="#e5e2e1" textAnchor="middle" fontSize="16">
          Raspberry Pi 5
        </text>
        <text x="110" y="92" fill="#9a9a9a" textAnchor="middle" fontSize="12">
          RP1 + Debian
        </text>

        <rect x="270" y="20" width="180" height="80" rx="12" fill="#131313" stroke="#2a2a2a" />
        <text x="360" y="50" fill="#e5e2e1" textAnchor="middle" fontSize="15">
          ST7796S LCD
        </text>
        <text x="360" y="72" fill="#9a9a9a" textAnchor="middle" fontSize="11">
          SPI0, 320x480
        </text>

        <rect x="270" y="120" width="180" height="80" rx="12" fill="#131313" stroke="#2a2a2a" />
        <text x="360" y="150" fill="#e5e2e1" textAnchor="middle" fontSize="15">
          GT911 Touch
        </text>
        <text x="360" y="172" fill="#9a9a9a" textAnchor="middle" fontSize="11">
          I2C bus 1 @ 0x14
        </text>

        <rect x="270" y="220" width="180" height="60" rx="12" fill="#131313" stroke="#2a2a2a" />
        <text x="360" y="256" fill="#e5e2e1" textAnchor="middle" fontSize="15">
          PN532 NFC @ 0x24
        </text>

        <rect x="520" y="220" width="180" height="60" rx="12" fill="#131313" stroke="#2a2a2a" />
        <text x="610" y="255" fill="#e5e2e1" textAnchor="middle" fontSize="15">
          Android Phone
        </text>

        <line x1="200" y1="62" x2="270" y2="62" stroke="#c8f323" strokeWidth="2" />
        <text x="235" y="52" fill="#c8f323" textAnchor="middle" fontSize="10">
          SPI
        </text>

        <line x1="200" y1="160" x2="270" y2="160" stroke="#c8f323" strokeWidth="2" />
        <text x="235" y="150" fill="#c8f323" textAnchor="middle" fontSize="10">
          I2C bus 1
        </text>

        <line x1="200" y1="250" x2="270" y2="250" stroke="#c8f323" strokeWidth="2" />
        <text x="235" y="240" fill="#c8f323" textAnchor="middle" fontSize="10">
          I2C bus 3
        </text>

        <line x1="450" y1="250" x2="520" y2="250" stroke="#4eff91" strokeWidth="2" />
        <text x="485" y="240" fill="#4eff91" textAnchor="middle" fontSize="10">
          NFC 13.56MHz
        </text>
      </svg>
    </section>
  );
}
