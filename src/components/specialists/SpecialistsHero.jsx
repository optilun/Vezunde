import React from "react";

// Two-column claim-focused hero — copy + CTA on the left, abstract editorial
// location illustration on the right (stacks below CTA on mobile).
export default function SpecialistsHero() {
  const scrollToSearch = () => {
    document.getElementById("cauta-locatia")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-10 sm:pb-14 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div className="text-center lg:text-left">
        <h1 className="font-heading font-extrabold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-5xl">
          Gestioneaza modul in care apare locatia ta pe ViaSee.
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
          Revendica profilul unei optici, clinici, cabinet sau al unei locatii unde oferi servicii. Dupa aprobare, poti propune actualizari pentru informatiile publice ale locatiei.
        </p>
        <button
          onClick={scrollToSearch}
          className="mt-8 inline-flex items-center gap-2 bg-foreground text-background rounded-full px-7 py-3.5 font-medium hover:opacity-90 transition-opacity"
        >
          Cauta locatia ta
        </button>
      </div>
      <div className="order-first lg:order-last relative">
        <img
          src="https://media.base44.com/images/public/6a48cb9d04fa7f999d8a8054/efb2b57d5_generated_image.png"
          alt=""
          aria-hidden="true"
          className="w-full max-w-md mx-auto lg:max-w-none lg:scale-125"
        />
      </div>
    </section>
  );
}