import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ExternalLink } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import AdminSidebarContent from "./AdminSidebarContent";
import { ADMIN_NAV_LABELS } from "@/lib/adminNavConfig";

// Reusable admin app shell: fixed sidebar on desktop and a touch-friendly
// drawer plus compact utility bar on smaller screens.
export default function AdminAppShell({
  activeKey,
  onNavigate,
  user,
  onLogout,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (key) => {
    onNavigate(key);
    setMobileOpen(false);
  };
  const initials = (user?.full_name || "A").trim().charAt(0).toUpperCase();

  return (
    <div
      className="flex min-h-screen min-h-dvh overflow-x-hidden bg-background workspace-neutral"
      data-admin-mobile="true"
    >
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card">
        <AdminSidebarContent
          activeKey={activeKey}
          onNavigate={navigate}
          user={user}
          onLogout={onLogout}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(20rem,calc(100vw-1rem))] gap-0 overflow-y-auto p-0 safe-area-bottom safe-area-top [&>button]:z-10"
        >
          <AdminSidebarContent
            activeKey={activeKey}
            onNavigate={navigate}
            user={user}
            onLogout={onLogout}
          />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/88">
          <div className="flex min-h-14 items-center justify-between gap-2 px-3 safe-area-top sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
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
                  {ADMIN_NAV_LABELS[activeKey] || "Panou general"}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
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
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl overflow-x-clip px-3 py-5 outline-none sm:px-8 sm:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
