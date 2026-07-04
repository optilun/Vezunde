import React, { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <header
        className="sticky top-0 z-20 transition-all duration-500"
        style={{
          backgroundColor: scrolled ? "#FFFFFF" : "transparent",
          borderBottom: scrolled ? "1px solid #E8E8E8" : "1px solid transparent",
          boxShadow: scrolled ? "0 4px 20px rgba(20,20,20,0.05)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#171717" }}>V</div>
            <span className="font-heading text-lg font-bold tracking-tight">vezunde</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/cauta" className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">Cauta</Link>
            <Link to="/pentru-specialisti" className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pentru specialisti</Link>
            <Link
              to="/cerere"
              className="ml-3 px-5 py-2 rounded-full text-white font-medium transition-colors"
              style={{ backgroundColor: "#171717" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2B2B2B"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#171717"; }}
            >
              Trimite o cerere
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-5 py-12 grid gap-8 sm:grid-cols-3">
          <div>
            <div className="font-heading font-bold text-lg">vezunde</div>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">Spune ce ai nevoie. Vezi unde poti merge. Vezunde nu ofera diagnostic medical.</p>
          </div>
          <div className="text-sm space-y-2">
            <div className="font-medium mb-3">Platforma</div>
            <Link to="/cauta" className="block text-muted-foreground hover:text-foreground">Cauta furnizori</Link>
            <Link to="/cerere" className="block text-muted-foreground hover:text-foreground">Trimite o cerere</Link>
            <Link to="/pentru-specialisti" className="block text-muted-foreground hover:text-foreground">Pentru specialisti</Link>
            <Link to="/revendica-profil" className="block text-muted-foreground hover:text-foreground">Revendica un profil</Link>
          </div>
          <div className="text-sm space-y-2">
            <div className="font-medium mb-3">Legal</div>
            <Link to="/confidentialitate" className="block text-muted-foreground hover:text-foreground">Confidentialitate</Link>
            <Link to="/termeni" className="block text-muted-foreground hover:text-foreground">Termeni si conditii</Link>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-5 py-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Vezunde. Date demonstrative fictive. Platforma de potrivire, nu de licitatii de pret.
          </div>
        </div>
      </footer>
    </div>
  );
}