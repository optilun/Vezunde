import React from "react";
import Hero from "@/components/home/Hero";
import QuickCategories from "@/components/home/QuickCategories";
import WhoCanHelp from "@/components/home/WhoCanHelp";
import HowItWorks from "@/components/home/HowItWorks";
import ServicesShowcase from "@/components/home/ServicesShowcase";
import FeaturedProviders from "@/components/home/FeaturedProviders";
import ClosingCta from "@/components/home/ClosingCta";

export default function Home() {
  return (
    <div className="pb-12">
      <Hero />
      <QuickCategories />
      <WhoCanHelp />
      <HowItWorks />
      <ServicesShowcase />
      <FeaturedProviders />
      <ClosingCta />
    </div>
  );
}