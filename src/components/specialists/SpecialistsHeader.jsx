import React from "react";
import { Link } from "react-router-dom";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

// Minimal header for the specialists claim/manage entry point — no sales CTA.
export default function SpecialistsHeader() {
  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center" aria-label="VIASEE - Pagina principala">
          <ViaseeBrand />
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#cum-functioneaza" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Cum functioneaza</a>
          <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Autentificare</Link>
        </nav>
      </div>
    </header>
  );
}
