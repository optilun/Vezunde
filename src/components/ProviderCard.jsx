import React from "react";
import ResultCard from "@/components/results/ResultCard";

// Module UI-1: same visual language as the guided-flow result card, so Search
// and the conversational flow are visually equivalent for the same data.
const BUCKET_VARIANT = { top3: "top3", extended_confirmed: "confirmed", extended_directory: "directory" };

export default function ProviderCard({ location }) {
  return <ResultCard location={location} variant={BUCKET_VARIANT[location.result_bucket] || "neutral"} />;
}