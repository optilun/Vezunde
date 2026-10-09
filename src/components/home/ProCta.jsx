import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Search } from "lucide-react";
import Reveal from "@/components/common/Reveal";
import { prefetchOnIntent } from "@/lib/routePrefetch";

// 2026-10-09 (Alex: macheta, direcția C „Pe fundalul paginii”, cu mai puțin text). Secțiunea pentru
// furnizori stă direct pe fundalul paginii, fără card (nici negru, nici colorat), centrată ca
// „Servicii și specialiști”. Rămâne începutul revendicării: câmpul de căutare deschide pagina de
// revendicare cu textul deja completat (AddOrClaim -> ProviderSearch `initialQuery`).
// Fără pașii 01/02/03: secțiunea de deasupra („De la o întrebare…”) îi folosește deja.
// „Vezi cum funcționează” a ieșit: /pentru-specialisti e deja în meniul de sus și în subsol.

const BENEFITS = ["Tu confirmi ce apare public", "Vezi cererile din zona ta"];

function ViaseeMark() {
  return (
    <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-[0.3rem] bg-[#345bc8] sm:h-7 sm:w-7">
      <svg viewBox="0 0 40 40" className="h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="#F8F4EC">
        <rect x="17" y="3" width="6" height="34" rx="2" />
        <rect x="3" y="17" width="34" height="6" rx="2" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(45 20 20)" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(-45 20 20)" />
      </svg>
    </span>
  );
}

function PathLink({ to, state, children }) {
  return (
    <Link
      to={to}
      state={state}
      {...prefetchOnIntent(to)}
      className="group flex min-h-12 items-center justify-between gap-3 border-b border-[#e4e1d8] text-sm font-semibold text-[#171717] outline-none last:border-b-0 hover:text-black focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] sm:min-h-11 sm:justify-center sm:gap-2 sm:rounded-full sm:border-b-0 sm:px-2 sm:text-[15px]"
    >
      {children}
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
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
      className="mx-auto mt-20 max-w-[84rem] px-5 sm:mt-36 lg:mt-44"
    >
      <Reveal threshold={0.08} className="flex flex-col items-center text-center">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ViaseeMark />
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5f625b] sm:text-[11px] sm:tracking-[0.24em]">
            Pentru optici, cabinete și clinici
          </p>
        </div>

        <h2
          id="professional-profile-title"
          className="mx-auto mt-4 max-w-[68rem] text-balance font-heading text-[2.25rem] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#171717] sm:mt-5 sm:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem]"
        >
          <span className="block lg:whitespace-nowrap">Locația ta e deja pe VIASEE.</span>
          <span className="mt-1 block font-display font-medium italic tracking-[-0.04em] text-[#a97825] sm:mt-1.5">Revendic-o gratuit.</span>
        </h2>

        <form onSubmit={submit} role="search" className="mt-8 w-full max-w-[46rem] text-left sm:mt-11">
          <label htmlFor="home-claim-search" className="sr-only">
            Numele locației sau orașul
          </label>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:border sm:border-[#d8dbd2] sm:bg-white sm:py-2 sm:pl-6 sm:pr-2 sm:shadow-[0_16px_34px_rgba(23,23,23,0.07)] sm:focus-within:border-[#171717] sm:focus-within:ring-2 sm:focus-within:ring-[#171717]/15">
            <div className="flex h-14 items-center gap-2.5 rounded-full border border-[#d8dbd2] bg-white px-5 shadow-[0_12px_26px_rgba(23,23,23,0.07)] focus-within:border-[#171717] focus-within:ring-2 focus-within:ring-[#171717]/15 sm:h-auto sm:min-w-0 sm:flex-1 sm:border-0 sm:bg-transparent sm:px-0 sm:shadow-none sm:focus-within:ring-0">
              <Search className="h-[18px] w-[18px] shrink-0 text-[#5f625b] sm:h-5 sm:w-5" aria-hidden="true" />
              <input
                id="home-claim-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={120}
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Numele opticii sau orașul"
                className="min-w-0 flex-1 bg-transparent text-base text-[#171717] outline-none placeholder:text-[#8b8e84] sm:text-[17px]"
              />
            </div>
            <button
              type="submit"
              {...prefetchOnIntent("/adauga-sau-revendica")}
              className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-full bg-[#171717] py-2 pl-6 pr-2 text-[15px] font-bold text-[#F8F4EC] outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.22)] active:translate-y-0 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:w-auto sm:shrink-0 sm:text-base"
            >
              Caută și revendică
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F4EC] text-[#171717]">
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </span>
            </button>
          </div>
        </form>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm font-semibold text-[#171717] sm:mt-7 sm:text-[15px]">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2">
              <Check className="h-[18px] w-[18px] shrink-0 text-[#a97825]" strokeWidth={2.6} aria-hidden="true" />
              {benefit}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex w-full max-w-[46rem] flex-col border-t border-[#d8dbd2] pt-1 text-left sm:mt-10 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:pt-4">
          <PathLink to="/adauga-sau-revendica" state={{ startFlow: "new_location" }}>Nu o găsești? Adaugă o locație nouă</PathLink>
          <PathLink to="/profil-profesional/nou">Specialist independent? Creează-ți profilul</PathLink>
        </div>
      </Reveal>
    </section>
  );
}
