import React, { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import AdminSidebarContent from "./AdminSidebarContent";
import { ADMIN_NAV_LABELS } from "@/lib/adminNavConfig";

// UI-1 PART 1: reusable admin app shell — fixed sidebar on desktop, drawer on
// mobile. Pure layout/navigation; no data, routes or permissions changed.
export default function AdminAppShell({ activeKey, onNavigate, user, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (key) => { onNavigate(key); setMobileOpen(false); };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-card">
        <AdminSidebarContent activeKey={activeKey} onNavigate={navigate} user={user} onLogout={onLogout} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 gap-0 [&>button]:z-10">
          <AdminSidebarContent activeKey={activeKey} onNavigate={navigate} user={user} onLogout={onLogout} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 lg:pl-64 min-w-0">
        <div className="lg:hidden sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-secondary" aria-label="Deschide meniul">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-sm truncate">{ADMIN_NAV_LABELS[activeKey] || "Administrare"}</span>
        </div>
        <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}