import React from "react";

// Direct claim-focused hero — restrained copy, single CTA, no illustrations.
export default function SpecialistsHero() {
  const scrollToSearch = () => {
    document.getElementById("cauta-locatia")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="max-w-3xl mx-auto px-5 pt-16 sm:pt-24 pb-14 sm:pb-20 text-center">
      <h1 className="font-heading font-extrabold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-5xl">
        Gestioneaza modul in care apare locatia ta pe ViaSee.
      </h1>
      <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
        Revendica profilul unei optici, clinici, cabinet sau al unei locatii unde oferi servicii. Dupa aprobare, poti propune actualizari pentru informatiile publice ale locatiei.
      </p>
      <button
        onClick={scrollToSearch}
        className="mt-8 inline-flex items-center gap-2 bg-foreground text-background rounded-full px-7 py-3.5 font-medium hover:opacity-90 transition-opacity"
      >
        Cauta locatia ta
      </button>
    </section>
  );
}