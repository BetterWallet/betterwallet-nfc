export type PartItem = {
  id: string;
  label: string;
  model: string;
  estimatedCost: string;
  url: string;
};

export const parts: PartItem[] = [
  {
    id: "pi-zero",
    label: "Single-board computer",
    model: "Raspberry Pi Zero",
    estimatedCost: "$20",
    url: "https://example.com/add-pi5-link",
  },
  {
    id: "pn532",
    label: "NFC reader",
    model: "PN532 breakout board",
    estimatedCost: "$3",
    url: "https://example.com/add-pn532-link",
  },
  {
    id: "waveshare",
    label: "Display + touch",
    model: 'Waveshare 3.5" RPi LCD (F)',
    estimatedCost: "$7",
    url: "https://example.com/add-display-link",
  },
  {
    id: "misc",
    label: "Other misc",
    model: "Wires, connectors, mount hardware",
    estimatedCost: "$5",
    url: "https://example.com/add-misc-link",
  },
];

export const buildLinks = [
  {
    label: "GitHub repository",
    url: "https://github.com/BetterWallet/betterwallet-nfc",
  },
  {
    label: "Hardware setup doc",
    url: "https://github.com/BetterWallet/betterwallet-nfc/tree/main/doc",
  },
];
