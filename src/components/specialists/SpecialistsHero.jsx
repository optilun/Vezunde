import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, UserRound } from "lucide-react";

export default function SpecialistsHero() {
  const navigate = useNavigate();

  return (
    <section className="max-w-6xl mx-auto px-5 pt-10 sm:pt-16 pb-16 sm:pb-24 grid lg:grid-cols-[46%_54%] gap-10 lg:gap-6 items-center relative">
      <img
        src="https://media.base44.com/images/public/6a48cb9d04fa7f999d8a8054/8bc17e08f_generated_image.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none order-first lg:order-last w-full max-w-md mx-auto lg:max-w-none lg:absolute lg:right-[-4%] lg:top-1/2 lg:-translate-y-1/2 lg:w-[64%] opacity-90"
        style={{
          maskImage: "radial-gradient(ellipse 68% 68% at 45% 50%, black 55%, transparent 96%)",
          WebkitMaskImage: "radial-gradient(ellipse 68% 68% at 45% 50%, black 55%, transparent 96%)",
        }}
      />

      <div className="relative z-10 text-center lg:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <UserRound className="h-3.5 w-3.5" /> Pentru profesionisti
        </div>
        <h1 className="mt-6 font-heading font-extrabold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-5xl">
          Creeaza profilul tau profesional pe VIASEE.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
          Pentru medici oftalmologi, optometristi si opticieni. Profilul profesional este separat de administrarea unei optici sau clinici.
        </p>

        <div className="mt-7 max-w-xl mx-auto lg:mx-0 rounded-3xl border border-border bg-card p-5 text-left shadow-sm sm:p-6">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> Completezi numai datele profesionale de baza.</div>
            <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> Profilul este verificat inainte de publicare.</div>
            <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> Asocierile cu locatii se confirma separat.</div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/inscriere-specialist")}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background sm:w-auto"
          >
            Creeaza profil profesional <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row lg:justify-start">
          <Building2 className="h-4 w-4 shrink-0" />
          <span>Reprezinti o optica, clinica sau un cabinet?</span>
          <button onClick={() => navigate("/pentru-organizatii")} className="font-semibold text-foreground underline underline-offset-4">Mergi la inscrierea organizatiei</button>
        </div>
      </div>
    </section>
  );
}
