import React from "react";
import SpecialistsHeader from "@/components/specialists/SpecialistsHeader";
import SpecialistsHero from "@/components/specialists/SpecialistsHero";
import StepsExplanation from "@/components/specialists/StepsExplanation";
import TrustNote from "@/components/specialists/TrustNote";
import SpecialistsFAQ from "@/components/specialists/SpecialistsFAQ";
import SpecialistsFooter from "@/components/specialists/SpecialistsFooter";

// Standalone claim/manage entry point for providers — its own minimal header
// and footer, intentionally not wrapped in the public site Layout.
export default function ForSpecialists() {
  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <SpecialistsHeader />
      <main className="flex-1">
        <SpecialistsHero />
        <StepsExplanation />
        <TrustNote />
        <SpecialistsFAQ />
      </main>
      <SpecialistsFooter />
    </div>
  );
}