import React from "react";
import Hero from "@/components/home/Hero";
import QuickCategories from "@/components/home/QuickCategories";
import HowItWorks from "@/components/home/HowItWorks";
import FairMatching from "@/components/home/FairMatching";
import FeaturedProviders from "@/components/home/FeaturedProviders";
import SpecialistsCta from "@/components/home/SpecialistsCta";

export default function Home() {
  return (
    <div className="pb-8">
      <Hero />
      <QuickCategories />
      <HowItWorks />
      <FairMatching />
      <FeaturedProviders />
      <SpecialistsCta />
    </div>
  );
}