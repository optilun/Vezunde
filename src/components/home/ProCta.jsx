import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Search } from "lucide-react";
import Reveal from "@/components/common/Reveal";
import { prefetchOnIntent } from "@/lib/routePrefetch";

// 2026-10-09 (Alex: macheta, varianta A „Caută-ți locația”). Secțiunea pentru furnizori a devenit
// începutul revendicării: în locul ilustrației abstracte (cardul cu bare gri), un câmp de căutare
// care deschide pagina de revendicare cu textul deja completat (AddOrClaim -> ProviderSearch
// `initialQuery`). Fără pașii 01/02/03: secțiunea de deasupra („De la o întrebare…”) îi folosește deja.
// Numărul de locații e rotunjit în jos („peste 1.000”; 1.462 publicate la 2026-10-09), ca să nu
// descărcăm harta națională (≈450 KB) pe pagina principală doar pentru un număr.

const BENEFITS = [
  "Revendicarea e gratuită",
  "Tu confirmi ce apare public",
  "Vezi cererile din zona ta",
];

const MONO_LABEL = "font-mono text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-[11px] sm:tracking-[0.24em]";

function ViaseeMark() {
  return (
    <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.35rem] bg-[#345bc8]">
      <svg viewBox="0 0 40 40" className="h-5 w-5" fill="#F8F4EC">
        <rect x="17" y="3" width="6" height="34" rx="2" />
        <rect x="3" y="17" width="34" height="6" rx="2" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(45 20 20)" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(-45 20 20)" />
      </svg>
    </span>
  );
}

function PanelLink({ to, state, children }) {
  return (
    <Link
      to={to}
      state={state}
      {...prefetchOnIntent(to)}
      className="group flex min-h-12 items-center justify-between gap-3 rounded-lg text-sm font-semibold text-[#171717] outline-none hover:text-black focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] sm:text-[15px]"
    >
      {children}
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>
  );
}

function HowItWorksLink({ className = "" }) {
  return (
    <Link
      to="/pentru-specialisti"
      {...prefetchOnIntent("/pentru-specialisti")}
      className={`items-center gap-2 min-h-11 text-sm font-semibold text-[#F8F4EC]/80 underline decoration-[#F8F4EC]/30 underline-offset-[5px] outline-none hover:text-[#F8F4EC] hover:decoration-[#F8F4EC]/60 focus-visible:ring-2 focus-visible:ring-[#F8F4EC] focus-visible:ring-offset-4 focus-visible:ring-offset-[#171717] sm:text-[15px] ${className}`}
    >
      Vezi cum funcționează
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export default function ProCta() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const searchQuery = query.trim().slice(0, 120);
    navigate("/adauga-sau-revendica", searchQuery ? { state: { searchQuery } } : undefined);
  };

  return (
    <section
      aria-labelledby="professional-profile-title"
      className="mx-auto mt-16 max-w-[84rem] px-5 sm:mt-36 lg:mt-44"
    >
      {/* Umbra e box-shadow (nu filtru drop-shadow) si fara will-change permanent. */}
      <Reveal
        threshold={0.08}
        className="relative grid gap-8 overflow-hidden rounded-[1.75rem_1.75rem_0.625rem_1.75rem] bg-[#171717] px-6 pb-6 pt-9 text-[#F8F4EC] shadow-[0_22px_30px_rgba(23,23,23,0.10)] sm:gap-10 sm:rounded-[2.25rem_2.25rem_0.75rem_2.25rem] sm:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:gap-14 lg:p-16"
      >
        <div className="min-w-0">
          <p className={`${MONO_LABEL} text-[#F8F4EC]/[0.62]`}>Pentru optici, cabinete și clinici</p>

          <h2
            id="professional-profile-title"
            className="mt-4 max-w-[45rem] font-heading text-[2.5rem] font-extrabold leading-[0.97] tracking-[-0.055em] sm:mt-5 sm:text-[clamp(2.75rem,5vw,4.75rem)] sm:leading-[0.95] sm:tracking-[-0.06em]"
          >
            Locația ta e deja pe VIASEE.
            <span className="mt-1 block font-display font-medium italic tracking-[-0.04em] sm:mt-1.5 sm:tracking-[-0.045em]">Revendic-o gratuit.</span>
          </h2>

          <p className="mt-5 max-w-[38rem] text-[15px] leading-relaxed text-[#F8F4EC]/[0.72] sm:mt-7 sm:text-lg">
            Completezi serviciile, programul și echipa. Clienții din zona ta te găsesc cu informații confirmate de tine, iar cererile lor ajung în contul tău.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5 text-sm font-semibold text-[#F8F4EC]/[0.86] sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-3 sm:text-[15px]">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5">
                <Check className="h-[18px] w-[18px] shrink-0 text-[#c9a85c]" strokeWidth={2.6} aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>

          <HowItWorksLink className="mt-8 hidden lg:inline-flex" />
        </div>

        <div className="min-w-0 rounded-[1.375rem] bg-[#F8F4EC] px-5 py-6 text-[#171717] shadow-[0_18px_40px_rgba(0,0,0,0.28)] sm:rounded-[1.75rem] sm:p-8">
          <div className="flex items-center gap-3">
            <ViaseeMark />
            <span className={`${MONO_LABEL} font-bold text-[#5c5f57]`}>Caută-ți locația</span>
          </div>
          <h3 className="mt-5 font-heading text-[1.375rem] font-extrabold leading-[1.12] tracking-[-0.035em] sm:mt-6 sm:text-[1.75rem] sm:tracking-[-0.04em]">
            Începe cu numele sau orașul.
          </h3>
          <p className="mt-2.5 hidden text-[15px] leading-relaxed text-[#5c5f57] sm:block">
            Îți arătăm profilul existent și îl revendici în câțiva pași.
          </p>

          <form onSubmit={submit} className="mt-5 sm:mt-6">
            <label htmlFor="home-claim-search" className="block text-[13px] font-bold">
              Numele locației sau orașul
            </label>
            <div className="mt-2 flex h-[3.25rem] items-center gap-2.5 rounded-full border border-[#d8dbd2] bg-white px-4 focus-within:border-[#171717] focus-within:ring-2 focus-within:ring-[#171717]/15 sm:h-14 sm:px-5">
              <Search className="h-[18px] w-[18px] shrink-0 text-[#5c5f57]" aria-hidden="true" />
              <input
                id="home-claim-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={120}
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Ex.: numele opticii, Cluj-Napoca"
                className="min-w-0 flex-1 bg-transparent text-base text-[#171717] outline-none placeholder:text-[#8b8e84]"
              />
            </div>
            <button
              type="submit"
              {...prefetchOnIntent("/adauga-sau-revendica")}
              className="group mt-3 flex min-h-14 w-full items-center justify-between gap-4 rounded-full bg-[#171717] py-2 pl-6 pr-2 text-[15px] font-bold text-[#F8F4EC] outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.22)] active:translate-y-0 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:mt-3.5 sm:text-base"
            >
              Caută și revendică
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F4EC] text-[#171717]">
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </span>
            </button>
          </form>

          <p className="mt-4 text-[13px] leading-normal text-[#5c5f57]">
            <strong className="font-bold text-[#171717]">Peste 1.000 de locații</strong> sunt deja listate în director.
          </p>

          <div className="mt-5 flex flex-col border-t border-[#d8dbd2] pt-3 sm:mt-6 sm:pt-4">
            <PanelLink to="/adauga-sau-revendica" state={{ startFlow: "new_location" }}>Nu o găsești? Adaugă o locație nouă</PanelLink>
            <PanelLink to="/profil-profesional/nou">Ești specialist independent? Creează-ți profilul</PanelLink>
          </div>
        </div>

        <HowItWorksLink className="inline-flex justify-self-center lg:hidden" />
      </Reveal>
    </section>
  );
}
