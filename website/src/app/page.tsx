import { BuildGuide } from "@/components/landing/BuildGuide";
import { CircuitDiagrams } from "@/components/landing/CircuitDiagrams";
import { ClearSigningDemo } from "@/components/landing/ClearSigningDemo";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { OriginStory } from "@/components/landing/OriginStory";
import { PartsBom } from "@/components/landing/PartsBom";
import { ProblemCollage } from "@/components/landing/ProblemCollage";
import { WalkthroughVideos } from "@/components/landing/WalkthroughVideos";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="relative">
        <Nav />
        <main>
          <Hero />
          <WalkthroughVideos />
          <ProblemCollage />
          <ClearSigningDemo />
          <ComparisonTable />
          <OriginStory />
          <BuildGuide />
          <CircuitDiagrams />
          <PartsBom />
        </main>
        <Footer />
      </div>
    </div>
  );
}
