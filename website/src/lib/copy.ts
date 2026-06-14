export const navItems = [
  { label: "Why", href: "#why" },
  { label: "Story", href: "#story" },
  { label: "Build", href: "#build" },
  { label: "Parts", href: "#parts" },
  { label: "GitHub", href: "https://github.com/BetterWallet/betterwallet-nfc" },
];

export const timeline = [
  {
    title: "ETH Online 2025 — 2nd place",
    detail: "Built the first Better Wallet using an old phone as offline hot and cold wallet.",
  },
  {
    title: "Stellar Builder Garage — 1st place",
    detail: "Extended the same project with hardware-assisted QR-code signing.",
  },
  {
    title: "Solana Colosseum Network State Bounty — 2nd place",
    detail: "Won second place with Better Wallet while iterating on Solana-focused flows.",
  },
  {
    title: "ETHGlobal New York 2026 rearchitecture",
    detail:
      "Revamped the hardware for NFC-first UX and built a new app from scratch for cross-chain, EVM, and Solana.",
  },
];

export const comparisonColumns = ["Ledger", "SafePAL", "Tangem", "Better Wallet"];

export const comparisonRows = [
  {
    label: "Airgapped",
    values: ["x", "QR", "NFC", "NFC"],
  },
  {
    label: "Clear signing",
    values: ["yes", "x", "x", "yes"],
  },
  {
    label: "Hardware open source",
    values: ["x", "partial", "x", "DIY"],
  },
  {
    label: "Cost",
    values: ["$200-$400", "$70-$100", "$59-$180", "$30-$40"],
  },
  {
    label: "Malicious app attack?",
    values: [
      "Incidents reported",
      "Possible with blind signing",
      "Possible with blind signing",
      "No",
    ],
  },
];

export const buildSteps = [
  {
    title: "Enable SPI + I2C on Pi 5",
    command: "sudo nano /boot/firmware/config.txt",
    detail: "Enable spi and i2c, then reboot.",
  },
  {
    title: "Wire PN532 to I2C bus 3",
    command: "SDA -> GPIO6 (pin31), SCL -> GPIO7 (pin26)",
    detail: "Keep bus 1 free for GT911 touch.",
  },
  {
    title: "Mount the Waveshare 3.5 LCD HAT",
    command: "dtoverlay=mipi-dbi-spi,speed=48000000",
    detail: "Display runs as card1 under /dev/dri.",
  },
  {
    title: "Patch pn532pi for Pi 5",
    command: "python3 pi/pn532i2c_patch.py",
    detail: "Handle errno 121 (EREMOTEIO) on RP1.",
  },
  {
    title: "Run the Better Wallet UI",
    command:
      "SDL_VIDEODRIVER=kmsdrm SDL_VIDEO_KMSDRM_DEVICE_INDEX=1 python3 pi/gui/demo.py",
    detail: "Cycles idle -> tap1 -> signing -> tap2 -> done.",
  },
];
