import React from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
import AuthArtworkPanel from "@/components/brand/AuthArtworkPanel";

export default function OnboardingLayout({
  children,
  artworkTitle = ["Profilul tău.", "Mai aproape", "de clienți."],
  artworkSubtitle = "Prezintă clar serviciile, echipa și locurile în care îi poți ajuta.",
}) {
  return (
    <div className="workspace-neutral min-h-[100dvh] bg-card text-foreground lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:p-6" data-onboarding-layout>
      <div className="flex min-h-[100dvh] min-w-0 flex-col px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-10 lg:min-h-[calc(100dvh-3rem)] lg:px-5 lg:py-2 xl:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="VIASEE — Pagina principală" className="inline-flex min-h-11 w-fit items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            <ViaseeBrand symbolClassName="h-9 w-10" wordmarkClassName="h-6 w-auto" />
          </Link>
          <Link to="/pentru-specialisti" aria-label="Închide formularul și revino la pagina pentru specialiști" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            <X className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>
        <main id="main-content" className="mx-auto w-full min-w-0 max-w-[600px] flex-1 py-8 sm:py-10" data-onboarding-form>
          {children}
        </main>
        <nav aria-label="Informații legale" className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <Link to="/termeni" className="inline-flex min-h-11 items-center underline underline-offset-4">Termeni și condiții</Link>
          <Link to="/confidentialitate" className="inline-flex min-h-11 items-center underline underline-offset-4">Confidențialitate</Link>
        </nav>
      </div>
      <AuthArtworkPanel titleLines={artworkTitle} subtitle={artworkSubtitle} />
    </div>
  );
}
