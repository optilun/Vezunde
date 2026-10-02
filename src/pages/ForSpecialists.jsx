import React from "react";
import SpecialistsHeader from "@/components/specialists/SpecialistsHeader";
import SpecialistsHero from "@/components/specialists/SpecialistsHero";
import SpecialistsCapabilities from "@/components/specialists/SpecialistsCapabilities";
import StepsExplanation from "@/components/specialists/StepsExplanation";
import SpecialistsFAQ from "@/components/specialists/SpecialistsFAQ";
import SpecialistsFooter from "@/components/specialists/SpecialistsFooter";

export default function ForSpecialists() {
  return (
    <div className="flex min-h-screen min-h-dvh min-w-0 flex-col overflow-x-clip bg-[#F8F4EC] font-body text-[#211c25]" style={{ backgroundImage: "radial-gradient(rgba(52,48,43,0.12) 0.7px, transparent 0.8px)", backgroundSize: "24px 24px" }}>
      <SpecialistsHeader />
      <main className="min-w-0 flex-1 overflow-x-clip">
        <SpecialistsHero />
        <StepsExplanation />
        <SpecialistsCapabilities />
        <SpecialistsFAQ />
      </main>
      <SpecialistsFooter />
    </div>
  );
}
