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
  const profilePhotoUrl = user?.profile_photo_url || "";
  const activeLabel =
    navItems.find((item) => item.key === activeKey)?.label ||
    navItems[0]?.label ||
    "";
  const mobileModeSwitches = modeSwitches?.map((item) => ({
    ...item,
    onClick: () => {
      item.onClick?.();
      setMobileOpen(false);
    },
    onSettings: item.onSettings
      ? () => {
          item.onSettings();
          setMobileOpen(false);
        }
      : undefined,
  }));

  return (
    <div className="flex min-h-screen min-h-dvh overflow-x-hidden bg-background workspace-neutral">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card">
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
        <SheetContent
          side="left"
          className="w-[min(20rem,calc(100vw-1rem))] gap-0 overflow-hidden p-0 safe-area-bottom safe-area-top [&>button]:z-10"
        >
          <ProviderSidebarContent
            navItems={navItems}
            activeKey={activeKey}
            onNavigate={(key) => {
              onNavigate(key);
              setMobileOpen(false);
            }}
            user={user}
            onLogout={onLogout}
            title={title}
            subtitle={subtitle}
            modeSwitch={
              modeSwitch
                ? {
                    ...modeSwitch,
                    onClick: () => {
                      modeSwitch.onClick?.();
                      setMobileOpen(false);
                    },
                  }
                : null
            }
            modeSwitches={mobileModeSwitches}
          />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/88">
          <div className="flex min-h-14 items-center justify-between gap-2 px-3 safe-area-top sm:px-5 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="-ml-1 inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl hover:bg-secondary active:bg-secondary lg:hidden"
                aria-label="Deschide meniul"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                <span className="hidden sm:inline">
                  {subtitle || "Contul meu"}{" "}
                  <span className="mx-1 text-border">/</span>
                </span>
                <span className="font-medium text-foreground">
                  {activeLabel}
                </span>
              </span>
              <div className="hidden shrink-0 md:block">{statusBadge}</div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              {publicProfileUrl && (
                <Link
                  to={publicProfileUrl}
                  className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm"
                >
                  <span className="hidden sm:inline">Vezi profilul public</span>
                  <span className="sm:hidden">Profil</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                title={user?.full_name || ""}
              >
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    decoding="async"
                  />
                ) : (
                  initials
                )}
              </div>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl overflow-x-clip px-3 py-5 outline-none workspace-mobile-surface sm:px-6 sm:py-7 lg:px-10 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
