import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ExternalLink } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import ProviderSidebarContent from "./ProviderSidebarContent";
import { PROVIDER_NAV_LABELS } from "@/lib/providerNavConfig";

// UI-1.1 PART 2: internal shell for authenticated provider/specialist account
// pages — sidebar + compact utility top bar, no public navbar.
export default function ProviderAppShell({ activeKey = "overview", user, onLogout, publicProfileUrl, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (user?.full_name || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background flex workspace-neutral">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-card">
        <ProviderSidebarContent activeKey={activeKey} onNavigate={() => {}} user={user} onLogout={onLogout} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 gap-0 [&>button]:z-10">
          <ProviderSidebarContent activeKey={activeKey} onNavigate={() => setMobileOpen(false)} user={user} onLogout={onLogout} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 lg:pl-64 min-w-0">
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-secondary shrink-0" aria-label="Deschide meniul">
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs sm:text-sm text-muted-foreground truncate">
              Contul meu <span className="mx-1 text-border">/</span>
              <span className="text-foreground font-medium">{PROVIDER_NAV_LABELS[activeKey] || "Prezentare generala"}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {publicProfileUrl && (
              <Link to={publicProfileUrl} className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
                Vezi profilul public <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0" title={user?.full_name || ""}>
              {initials}
            </div>
          </div>
        </div>
        <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}