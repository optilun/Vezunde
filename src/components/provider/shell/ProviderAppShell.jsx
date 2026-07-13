import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ExternalLink } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import ProviderSidebarContent from "./ProviderSidebarContent";
import "@/styles/workspace-mobile.css";

export default function ProviderAppShell({
  navItems,
  activeKey,
  onNavigate,
  user,
  onLogout,
  publicProfileUrl = "",
  title,
  subtitle = "",
  statusBadge = null,
  modeSwitch = null,
  modeSwitches = [],
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (user?.full_name || "U").trim().charAt(0).toUpperCase();
  const activeLabel = navItems.find((item) => item.key === activeKey)?.label || navItems[0]?.label || "";
  const mobileModeSwitches = modeSwitches?.map((item) => ({
    ...item,
    onClick: () => {
      item.onClick?.();
      setMobileOpen(false);
    },
  }));

  return (
    <div className="min-h-screen min-h-dvh bg-background flex workspace-neutral overflow-x-hidden">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-card">
        <ProviderSidebarContent
          navItems={navItems}
          activeKey={activeKey}
          onNavigate={onNavigate}
          user={user}
          onLogout={onLogout}
          title={title}
          subtitle={subtitle}
          modeSwitch={modeSwitch}
          modeSwitches={modeSwitches}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-1rem))] p-0 gap-0 [&>button]:z-10 overflow-hidden">
          <ProviderSidebarContent
            navItems={navItems}
            activeKey={activeKey}
            onNavigate={(key) => { onNavigate(key); setMobileOpen(false); }}
            user={user}
            onLogout={onLogout}
            title={title}
            subtitle={subtitle}
            modeSwitch={modeSwitch ? { ...modeSwitch, onClick: () => { modeSwitch.onClick?.(); setMobileOpen(false); } } : null}
            modeSwitches={mobileModeSwitches}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <div className="min-h-14 px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-2 safe-area-top">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden inline-flex h-11 w-11 -ml-1 items-center justify-center rounded-xl hover:bg-secondary active:bg-secondary shrink-0 touch-manipulation"
                aria-label="Deschide meniul"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="text-xs sm:text-sm text-muted-foreground truncate min-w-0">
                <span className="hidden sm:inline">{subtitle || "Contul meu"} <span className="mx-1 text-border">/</span></span>
                <span className="text-foreground font-medium">{activeLabel}</span>
              </span>
              <div className="hidden md:block shrink-0">{statusBadge}</div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {publicProfileUrl && (
                <Link
                  to={publicProfileUrl}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors touch-manipulation"
                >
                  <span className="hidden sm:inline">Vezi profilul public</span>
                  <span className="sm:hidden">Profil</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0" title={user?.full_name || ""}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="workspace-mobile-surface w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-10 py-5 sm:py-7 lg:py-8 overflow-x-clip">
          {children}
        </main>
      </div>
    </div>
  );
}
