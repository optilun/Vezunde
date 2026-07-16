import React, { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import HeaderAccountLink from "@/components/HeaderAccountLink";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { openCookieSettings } from "@/lib/cookieConsent";
import { VIASEE_COMPANY } from "@/lib/legal";

const MOBILE_LINKS = [
  { to: "/cauta", label: "Caută" },
  { to: "/ghid", label: "Ghid pentru vedere" },
  { to: "/parteneri", label: "Parteneri" },
  { to: "/pentru-specialisti", label: "Pentru specialiști" },
  { to: "/adauga-sau-revendica", label: "Adaugă sau revendică un profil" },
];

const desktopNavLinkClassName = ({ isActive }) =>
  `inline-flex min-h-11 items-center rounded-lg px-3.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${
    isActive
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground"
  }`;

function DesktopHeader({ scrolled }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 hidden border-b transition-[background-color,border-color,backdrop-filter] duration-300 md:block ${
        scrolled
          ? "border-border/70 bg-background/88 backdrop-blur-sm"
          : "border-transparent bg-background"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-8">
        <Link
          to="/"
          className="flex min-w-0 items-center"
          aria-label="VIASEE - Pagina principală"
        >
          <ViaseeBrand
            symbolClassName="h-8 w-8"
            wordmarkClassName="h-[18px] w-auto"
          />
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink to="/cauta" className={desktopNavLinkClassName}>
            Caută
          </NavLink>
          <NavLink
            to="/ghid"
            className={({ isActive }) =>
              `${desktopNavLinkClassName({ isActive })} hidden lg:inline-flex`
            }
          >
            Ghid
          </NavLink>
          <NavLink to="/parteneri" className={desktopNavLinkClassName}>
            Parteneri
          </NavLink>
          <NavLink to="/pentru-specialisti" className={desktopNavLinkClassName}>
            Pentru specialiști
          </NavLink>
          <HeaderAccountLink />
          <Link
            to="/cerere"
            className="ml-2 inline-flex min-h-11 items-center rounded-full bg-[#171717] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2B2B2B]"
          >
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
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 safe-area-top md:hidden ${
        scrolled
          ? "border-[#E8E8E8] bg-white shadow-[0_4px_20px_rgba(20,20,20,0.05)]"
          : "border-transparent bg-white/85 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 items-center justify-between gap-2 px-4 sm:px-8">
        <Link
          to="/"
          className="flex min-w-0 items-center"
          aria-label="VIASEE - Pagina principală"
        >
          <ViaseeBrand
            symbolClassName="h-8 w-8"
            wordmarkClassName="h-[18px] w-auto"
          />
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

function FooterLinkGroup({ title, children }) {
  return (
    <nav aria-label={title} className="border-t border-[#171717] pt-4">
      <h2 className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">
        {title}
      </h2>
      <div className="mt-3 space-y-0.5 text-sm">{children}</div>
    </nav>
  );
}

const footerLinkClassName =
  "flex min-h-11 items-center text-[#5f5a53] transition-colors hover:text-[#171717]";

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let animationFrame = 0;
    const updateScrolled = () => {
      const nextScrolled = window.scrollY > 8;
      setScrolled((current) =>
        current === nextScrolled ? current : nextScrolled,
      );
    };
    const onScroll = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        updateScrolled();
      });
    };
    updateScrolled();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-background font-body text-foreground">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[80] -translate-y-24 rounded-full bg-[#171717] px-5 py-3 text-sm font-semibold text-white transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        Sari la conținut
      </a>
      <DesktopHeader scrolled={scrolled} />
      <div aria-hidden="true" className="hidden h-16 md:block" />
      <MobileHeader
        scrolled={scrolled}
        onMenuOpen={() => setMobileOpen(true)}
      />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="w-[min(22rem,calc(100vw-1rem))] overflow-y-auto p-0 safe-area-top safe-area-bottom"
        >
          <SheetHeader className="border-b border-border px-5 py-5 text-left">
            <SheetTitle className="sr-only">Navigație VIASEE</SheetTitle>
            <ViaseeBrand
              symbolClassName="h-8 w-8"
              wordmarkClassName="h-[18px] w-auto"
            />
          </SheetHeader>
          <div className="space-y-1 px-4 py-5">
            {MOBILE_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "hover:bg-secondary"
                  }`
                }
              >
                {item.label}
              </NavLink>
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

      <main
        id="main-content"
        tabIndex={-1}
        className={
          isHome
            ? "min-w-0 flex-1 overflow-visible outline-none"
            : "min-w-0 flex-1 overflow-x-clip outline-none"
        }
      >
        <Suspense
          fallback={
            <div
              className={`flex items-center justify-center ${
                isHome
                  ? "min-h-[calc(100svh-4rem)] bg-[#F7F2E8]"
                  : "min-h-[45vh]"
              }`}
              role="status"
              aria-live="polite"
            >
              <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">Se încarcă pagina...</span>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <footer
        className="relative mt-12 overflow-hidden border-t-2 border-[#171717] bg-[#f8f4ec] sm:mt-16"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(23,23,23,0.13) 1px, transparent 1.2px)",
          backgroundSize: "21px 21px",
        }}
      >
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))] lg:gap-12">
            <div className="sm:col-span-2 lg:col-span-1">
              <ViaseeBrand
                symbolClassName="h-9 w-9"
                wordmarkClassName="h-[18px] w-auto"
              />
              <p className="mt-5 max-w-sm text-sm leading-6 text-[#5f5a53]">
                Spune ce ai nevoie. Vezi unde poți merge. VIASEE oferă orientare
                și informații, nu diagnostic medical.
              </p>
              <a
                href={`mailto:${VIASEE_COMPANY.contactEmail}`}
                className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#171717] underline decoration-[#171717]/30 underline-offset-4"
              >
                {VIASEE_COMPANY.contactEmail}
              </a>
              <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[#77716a]">
                Disponibil în România
              </p>
            </div>

            <FooterLinkGroup title="Platforma">
              <Link to="/cauta" className={footerLinkClassName}>
                Caută
              </Link>
              <Link to="/ghid" className={footerLinkClassName}>
                Ghid pentru vedere
              </Link>
              <Link to="/cerere" className={footerLinkClassName}>
                Trimite o cerere
              </Link>
              <Link to="/parteneri" className={footerLinkClassName}>
                Parteneri
              </Link>
            </FooterLinkGroup>

            <FooterLinkGroup title="Pentru specialiști">
              <Link to="/pentru-specialisti" className={footerLinkClassName}>
                Descoperă VIASEE
              </Link>
              <Link to="/adauga-sau-revendica" className={footerLinkClassName}>
                Adaugă sau revendică un profil
              </Link>
              <Link to="/plati-si-abonamente" className={footerLinkClassName}>
                Plăți și abonamente
              </Link>
              <Link to="/ajutor-si-suport" className={footerLinkClassName}>
                Ajutor și suport
              </Link>
            </FooterLinkGroup>

            <FooterLinkGroup title="Legal și date">
              <Link to="/confidentialitate" className={footerLinkClassName}>
                Confidențialitate
              </Link>
              <Link to="/termeni" className={footerLinkClassName}>
                Termeni și condiții
              </Link>
              <Link to="/cookies" className={footerLinkClassName}>
                Politica de cookies
              </Link>
              <Link to="/drepturile-tale" className={footerLinkClassName}>
                Drepturile tale
              </Link>
              <button
                type="button"
                onClick={openCookieSettings}
                className={`${footerLinkClassName} w-full text-left`}
              >
                Setări cookies
              </button>
            </FooterLinkGroup>
          </div>
        </div>

        <div className="relative border-t border-[#bcb5aa] bg-[#f8f4ec]/90">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs leading-5 text-[#6a655e] safe-area-bottom sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <span>
              © {new Date().getFullYear()} VIASEE · {VIASEE_COMPANY.legalName}
            </span>
            <span>
              CUI {VIASEE_COMPANY.taxId} · ONRC{" "}
              {VIASEE_COMPANY.registrationNumber} ·{" "}
              {VIASEE_COMPANY.registeredOffice}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
