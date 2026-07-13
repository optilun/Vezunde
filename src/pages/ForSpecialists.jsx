import React from "react";
import SpecialistsHeader from "@/components/specialists/SpecialistsHeader";
import SpecialistsHero from "@/components/specialists/SpecialistsHero";
import StepsExplanation from "@/components/specialists/StepsExplanation";
import SpecialistsFAQ from "@/components/specialists/SpecialistsFAQ";
import SpecialistsFooter from "@/components/specialists/SpecialistsFooter";

export default function ForSpecialists() {
  return (
    <div className="flex min-h-screen min-h-dvh min-w-0 flex-col overflow-x-clip bg-background font-body text-foreground">
      <SpecialistsHeader />
      <main className="min-w-0 flex-1 overflow-x-clip">
        <SpecialistsHero />
        <StepsExplanation />
        <SpecialistsFAQ />
      </main>
      <SpecialistsFooter />
    </div>
  );
}
