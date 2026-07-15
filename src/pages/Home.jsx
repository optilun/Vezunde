import React from "react";
import Hero from "@/components/home/Hero";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import SituationExplainer from "@/components/home/SituationExplainer";
import ServicesEditorial from "@/components/home/ServicesEditorial";
import ProvidersShowcase from "@/components/home/ProvidersShowcase";
import ProCta from "@/components/home/ProCta";

export default function Home() {
  return (
    <div className="pb-16 overflow-x-clip">
      <Hero />
      <CategoryShowcase />
      <SituationExplainer />
      <ServicesEditorial />
      <ProvidersShowcase />
      <ProCta />
    </div>
  );
}
