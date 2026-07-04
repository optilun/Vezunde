import React from "react";

const WORDS = [
  "Control vedere",
  "Reparatii ochelari",
  "Lentile de contact",
  "Miopie la copii",
  "Consult oftalmologic",
  "Rame si lentile",
  "Investigatii OCT",
  "Reglaj rame",
];

export default function MarqueeStrip() {
  const row = [...WORDS, ...WORDS];
  return (
    <div className="mt-24 sm:mt-32 border-y border-border py-5 overflow-hidden select-none" aria-hidden>
      <div className="flex w-max animate-marquee gap-0 hover:[animation-play-state:paused]">
        {row.map((w, i) => (
          <span key={i} className="flex items-center shrink-0">
            <span className="font-display italic text-xl sm:text-2xl text-foreground/80 whitespace-nowrap px-6">{w}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          </span>
        ))}
      </div>
    </div>
  );
}