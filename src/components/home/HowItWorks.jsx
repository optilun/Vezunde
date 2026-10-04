import React from "react";
import ClientJourneyVideo from "./ClientJourneyVideo";

export default function HowItWorks() {
  return (
    <section aria-labelledby="client-journey-heading" className="mx-auto mt-16 max-w-[84rem] px-5 sm:mt-28">
      <div className="mx-auto mb-7 max-w-4xl text-center sm:mb-10">
        <h2 id="client-journey-heading" className="text-[clamp(1.8rem,4vw,3.5rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-[#161816]">
          De la o întrebare, la opțiunile tale.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#71746d] sm:text-lg">
          Spui ce cauți. Descoperi specialiști și locații aproape de tine.
        </p>
      </div>
      <ClientJourneyVideo />
      <div className="mt-6 grid gap-5 sm:mt-8 sm:grid-cols-3 sm:gap-8">
        {[
          ["Descrii ce ai nevoie", "Scrii cu propriile cuvinte ce cauți."],
          ["Clarifici în câțiva pași", "Alegi pentru cine și în ce localitate cauți."],
          ["Compari și alegi", "Vezi opțiunile și verifici detaliile profilurilor."],
        ].map(([title, description], index) => (
          <div key={title} className="border-t border-[#d8dbd2] pt-4">
            <span className="font-mono text-xs tracking-widest text-[#8b8e84]">0{index + 1}</span>
            <h3 className="mt-2 text-lg font-bold tracking-tight text-[#161816] sm:text-xl">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#71746d] sm:text-base">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
