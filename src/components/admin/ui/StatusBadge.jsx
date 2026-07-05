import React from "react";

const TONES = {
  neutral: "bg-secondary text-foreground",
  green: "bg-green-100 text-green-800",
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
};

// UI-1 shared status badge — one consistent visual language for all states.
export default function StatusBadge({ label, tone = "neutral" }) {
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${TONES[tone] || TONES.neutral}`}>{label}</span>;
}