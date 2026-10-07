import React from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { ADMIN_NAV_PRIMARY, ADMIN_NAV_SECONDARY, adminHref } from "@/lib/adminNavConfig";
import { sidebarBadgeFor } from "@/lib/adminCounts";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
import { cn } from "@/lib/utils";

// Intrările sunt legături reale (2026-10-07): se pot deschide în alt tab, iar secțiunea activă e
// marcată pentru cititoarele de ecran. Numărul de pe dreapta = ce așteaptă după tine.
function NavItem({ item, active, badge, onClick }) {
  const Icon = item.icon;
  return (
    <Link
      to={adminHref(item.key)}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors lg:min-h-0",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-bold tabular-nums text-background">
          {badge}
          <span className="sr-only"> de rezolvat</span>
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({ items, activeKey, counts, onItemClick }) {
  return items.map((item) => (
    <div key={item.key}>
      {item.groupLabel && (
        <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {item.groupLabel}
        </p>
      )}
      <NavItem item={item} active={activeKey === item.key} badge={sidebarBadgeFor(counts, item.key)} onClick={onItemClick} />
    </div>
  ));
}

export default function AdminSidebarContent({ activeKey, user, onLogout, onItemClick = undefined }) {
  const { counts } = useAdminCounts();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-4">
        <ViaseeBrand />
        <p className="mt-1 pl-9 text-[11px] text-muted-foreground">Administrare</p>
      </div>

      {/* Un singur sector care derulează (2026-10-07): „Sistem” nu mai rămâne fixat sub listă, deci
          pe un ecran scund nu acoperă ultima intrare din „Clienți și comunicare”. */}
      <nav aria-label="Administrare" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        <NavGroup items={ADMIN_NAV_PRIMARY} activeKey={activeKey} counts={counts} onItemClick={onItemClick} />
        <NavGroup items={ADMIN_NAV_SECONDARY} activeKey={activeKey} counts={counts} onItemClick={onItemClick} />
      </nav>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.full_name || "Administrator"}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Deconectare"
          title="Deconectare"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:h-9 lg:w-9"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
