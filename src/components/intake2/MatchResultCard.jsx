import React from "react";
import ResultCard from "@/components/results/ResultCard";

// Module UI-1: variant is derived strictly from the existing result_bucket
// value returned by matchProviders — never recomputed or overridden here.
const BUCKET_VARIANT = { top3: "top3", extended_confirmed: "confirmed", extended_directory: "directory" };

export default function MatchResultCard({ location }) {
  return <ResultCard location={location} variant={BUCKET_VARIANT[location.result_bucket] || "neutral"} />;
}