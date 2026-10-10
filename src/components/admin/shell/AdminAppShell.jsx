import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ExternalLink, Search } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import AdminErrorBoundary from "./AdminErrorBoundary";
import AdminSidebarContent from "./AdminSidebarContent";
import AdminNotificationBell from "./AdminNotificationBell";
import { ADMIN_NAV_LABELS } from "@/lib/adminNavConfig";
import "@/styles/workspace-mobile.css";
import "@/styles/admin-surface.css";

// Căutarea globală se încarcă abia la prima deschidere (Ctrl/Cmd+K sau butonul din antet).
const AdminGlobalSearch = lazy(() => import("@/components/admin/AdminGlobalSearch"));

// Reusable admin app shell: fixed sidebar on desktop and a touch-friendly
// drawer plus compact utility bar on smaller screens.
// 2026-10-07: meniul este format din legături (adresă per secțiune), deci shell-ul nu mai primește
// `onNavigate`; închide doar sertarul de pe telefon după o alegere. Adăugat „Sari la conținut”.
export default function AdminAppShell({ activeKey, user, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const closeMobile = () => setMobileOpen(false);
  const initials = (user?.full_name || "A").trim().charAt(0).toUpperCase();
  const shortcutLabel = useMemo(
    () => (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "") ? "⌘K" : "Ctrl K"),
    [],
  );

  const openSearch = () => {
    setSearchMounted(true);
    setSearchOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchMounted(true);
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className="flex min-h-screen min-h-dvh overflow-x-hidden bg-background admin-surface"
      data-admin-mobile="true"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Sari la conținut
      </a>

      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card">
        <AdminSidebarContent activeKey={activeKey} user={user} onLogout={onLogout} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(20rem,calc(100vw-1rem))] gap-0 overflow-y-auto p-0 safe-area-bottom safe-area-top [&>button]:z-10"
        >
          <SheetTitle className="sr-only">Meniu administrare</SheetTitle>
          <SheetDescription className="sr-only">Alege secțiunea panoului de administrare.</SheetDescription>
          <AdminSidebarContent activeKey={activeKey} user={user} onLogout={onLogout} onItemClick={closeMobile} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/88">
          <div className="flex min-h-14 items-center gap-2 px-3 safe-area-top sm:px-6">
            <div className="flex min-w-0 items-center gap-2 md:flex-none">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-secondary active:bg-secondary lg:hidden"
                aria-label="Deschide meniul"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                <span className="hidden sm:inline">
                  Administrare <span className="mx-1 text-border">/</span>
                </span>
                <span className="font-medium text-foreground">
                  {ADMIN_NAV_LABELS[activeKey] || "Panou de azi"}
                </span>
              </span>
            </div>
            <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex">
              <button
                type="button"
                onClick={openSearch}
                aria-label="Caută în administrare"
                aria-keyshortcuts="Control+K Meta+K"
                className="inline-flex min-h-10 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">Caută o locație, persoană sau secțiune…</span>
                <kbd className="shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">{shortcutLabel}</kbd>
              </button>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3 md:ml-0">
              <button
                type="button"
                onClick={openSearch}
                aria-label="Caută în administrare"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-secondary active:bg-secondary md:hidden"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </button>
              {/* 2026-10-10: anunțurile pentru admin (tot ce intră și așteaptă o decizie). */}
              <AdminErrorBoundary variant="silent">
                <AdminNotificationBell />
              </AdminErrorBoundary>
              <Link
                to="/"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm"
              >
                <span className="hidden min-[360px]:inline">Vezi site-ul</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                title={user?.full_name || ""}
              >
                {initials}
              </div>
            </div>
          </div>
        </header>
        {searchMounted && (
          // Căutarea e o scurtătură: dacă nu se poate încărca, se închide fără să strice restul panoului.
          <AdminErrorBoundary variant="silent" resetKey={searchOpen} onError={() => setSearchOpen(false)}>
            <Suspense fallback={null}>
              <AdminGlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
            </Suspense>
          </AdminErrorBoundary>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className="workspace-mobile-surface mx-auto w-full max-w-6xl overflow-x-clip px-3 py-5 outline-none sm:px-8 sm:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
