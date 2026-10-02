import React from "react";
import { Link } from "react-router-dom";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

// Minimal header for the specialists claim/manage entry point — no sales CTA.
export default function SpecialistsHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#d9d2dc] bg-[#F8F4EC]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-8">
        <Link to="/" className="flex items-center" aria-label="VIASEE - Pagina principală">
          <ViaseeBrand />
        </Link>
        <nav aria-label="Navigare pentru specialiști" className="flex items-center gap-4 text-sm sm:gap-6">
          <a href="#cum-functioneaza" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Cum funcționează</a>
          <Link to="/login" className="inline-flex min-h-11 items-center rounded-full border border-[#d9d2dc] bg-[#fffdf9] px-4 text-xs font-semibold text-[#211c25] transition-colors hover:border-[#684d78] sm:px-5 sm:text-sm">Autentificare</Link>
        </nav>
      </div>
    </header>
  );
}
