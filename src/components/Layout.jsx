import React, { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import HeaderAccountLink from "@/components/HeaderAccountLink";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const MOBILE_LINKS = [
  { to: "/cauta", label: "Cauta" },
  { to: "/parteneri", label: "Parteneri" },
  { to: "/pentru-specialisti", label: "Pentru specialisti" },
  { to: "/adauga-sau-revendica", label: "Adauga sau revendica un profil" },
];

function DesktopHeader({ scrolled }) {
  return (
    <header
      className={`sticky top-0 z-40 hidden border-b transition-[background-color,border-color,backdrop-filter] duration-300 md:block ${
        scrolled
          ? "border-border/70 bg-background/80 backdrop-blur-md"
          : "border-transparent bg-background"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-8">
        <Link to="/" className="flex min-w-0 items-center" aria-label="VIASEE - Pagina principala">
          <ViaseeBrand symbolClassName="h-8 w-8" wordmarkClassName="h-[18px] w-auto" />
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link to="/cauta" className="rounded-lg px-3.5 py-2 text-muted-foreground transition-colors hover:text-foreground">Cauta</Link>
          <Link to="/parteneri" className="rounded-lg px-3.5 py-2 text-muted-foreground transition-colors hover:text-foreground">Parteneri</Link>
          <Link to="/pentru-specialisti" className="rounded-lg px-3.5 py-2 text-muted-foreground transition-colors hover:text-foreground">Pentru specialisti</Link>
          <HeaderAccountLink />
          <Link to="/cerere" className="ml-2 inline-flex min-h-11 items-center rounded-full bg-[#171717] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2B2B2B]">
            Trimite o cerere
          </Link>
        </nav>
      </div>
    </header>
  );
}

function MobileHeader({ scrolled, onMenuOpen }) {
  return (
    <header
      className={`sticky top-0 z-40 border-b transition-all duration-500 safe-area-top md:hidden ${
        scrolled
          ? "border-[#E8E8E8] bg-white shadow-[0_4px_20px_rgba(20,20,20,0.05)]"
          : "border-transparent bg-white/75 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 items-center justify-between gap-2 px-4 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center" aria-label="VIASEE - Pagina principala">
          <ViaseeBrand symbolClassName="h-8 w-8" wordmarkClassName="h-[18px] w-auto" />
        </Link>

        <div className="flex items-center gap-1">
          <HeaderAccountLink />
          <button
            type="button"
            onClick={onMenuOpen}
            className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl hover:bg-secondary active:bg-secondary"
            aria-label="Deschide meniul"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-background font-body text-foreground">
      <DesktopHeader scrolled={scrolled} />
      <MobileHeader scrolled={scrolled} onMenuOpen={() => setMobileOpen(true)} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[min(22rem,calc(100vw-1rem))] overflow-y-auto p-0 safe-area-top safe-area-bottom">
          <SheetHeader className="border-b border-border px-5 py-5 text-left">
            <SheetTitle className="sr-only">Navigatie VIASEE</SheetTitle>
            <ViaseeBrand symbolClassName="h-8 w-8" wordmarkClassName="h-[18px] w-auto" />
          </SheetHeader>
          <div className="space-y-1 px-4 py-5">
            {MOBILE_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border px-4 py-5">
            <Link
              to="/cerere"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#171717] px-5 text-sm font-semibold text-white"
            >
              Trimite o cerere
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 overflow-x-clip">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-border sm:mt-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3 sm:py-12">
          <div>
            <ViaseeBrand symbolClassName="h-8 w-8" wordmarkClassName="h-4 w-auto" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">Spune ce ai nevoie. Vezi unde poti merge. VIASEE nu ofera diagnostic medical.</p>
          </div>
          <div className="space-y-1 text-sm">
            <div className="mb-3 font-medium">Platforma</div>
            <Link to="/cauta" className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">Cauta furnizori</Link>
            <Link to="/cerere" className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">Trimite o cerere</Link>
            <Link to="/parteneri" className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">Parteneri B2B</Link>
            <Link to="/pentru-specialisti" className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">Pentru specialisti</Link>
            <Link to="/revendica-profil" className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">Revendica un profil</Link>
          </div>
          <div className="space-y-1 text-sm">
            <div className="mb-3 font-medium">Legal</div>
            <Link to="/confidentialitate" className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">Confidentialitate</Link>
            <Link to="/termeni" className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">Termeni si conditii</Link>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-4 text-xs leading-relaxed text-muted-foreground safe-area-bottom">
            © {new Date().getFullYear()} VIASEE. Date demonstrative fictive. Platforma de potrivire, nu de licitatii de pret.
          </div>
        </div>
      </footer>
    </div>
  );
}
