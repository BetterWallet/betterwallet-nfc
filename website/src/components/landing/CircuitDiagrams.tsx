import { BlockDiagram } from "@/components/diagrams/BlockDiagram";
import { NfcFlowDiagram } from "@/components/diagrams/NfcFlowDiagram";
import { PinoutDiagram } from "@/components/diagrams/PinoutDiagram";
import { SectionReveal } from "./SectionReveal";

export function CircuitDiagrams() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-6 py-20" delay={0.1}>
      <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)]">Circuit Diagrams</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Hardware and data flow, visually mapped
      </h2>
      <div className="mt-8 grid gap-4">
        <BlockDiagram />
        <div className="grid gap-4 md:grid-cols-2">
          <PinoutDiagram />
          <NfcFlowDiagram />
        </div>
      </div>
    </SectionReveal>
  );
}
