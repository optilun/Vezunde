import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CornerDownLeft, LayoutDashboard, LifeBuoy, MapPin, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { useAdminSearchData } from "@/components/admin/useAdminSearchData";
import { sidebarBadgeFor } from "@/lib/adminCounts";
import { buildGlobalIndexes, searchEverything } from "@/lib/adminGlobalSearch";
import { ADMIN_NAV_PRIMARY, ADMIN_NAV_SECONDARY, ADMIN_NAV_LABELS, adminHref } from "@/lib/adminNavConfig";

// Căutarea globală (Ctrl/Cmd+K): scrii numele unei locații, al unei organizații, al unui solicitant sau
// un telefon și ajungi direct la ea; fără text, e un meniu rapid cu toate secțiunile (inclusiv cele
// care nu au loc în bara laterală). Datele se citesc doar la prima deschidere.
const HIDDEN_SECTIONS = ["adauga", "import_directory", "geografie", "audit"];

const TYPE_ICONS = {
  section: LayoutDashboard,
  location: MapPin,
  organization: Building2,
  claim: UserCheck,
  ticket: LifeBuoy,
};

export default function AdminGlobalSearch({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { counts } = useAdminCounts();
  const { data, failed, loading } = useAdminSearchData(open);
  const [query, setQuery] = useState("");

  useEffect(() => { if (open) setQuery(""); }, [open]);

  const indexes = useMemo(() => buildGlobalIndexes(data || {}), [data]);
  const sections = useMemo(() => [
    ...ADMIN_NAV_PRIMARY.map((item) => item.key),
    ...ADMIN_NAV_SECONDARY.map((item) => item.key),
    ...HIDDEN_SECTIONS,
  ].map((key) => ({ key, label: ADMIN_NAV_LABELS[key] || key, count: sidebarBadgeFor(counts, key) || 0 })), [counts]);
  const groups = useMemo(() => searchEverything(indexes, query, sections), [indexes, query, sections]);
  const hasQuery = query.trim().length > 0;
  const entityGroups = groups.filter((group) => group.key !== "sections");

  const choose = (item) => {
    onOpenChange(false);
    navigate(adminHref(item.target.section, item.target.tab, item.target.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[10%] translate-y-0 gap-0 overflow-hidden p-0 data-[state=closed]:slide-out-to-top-[10%] data-[state=open]:slide-in-from-top-[10%] sm:max-w-xl">
        <DialogTitle className="sr-only">Căutare în administrare</DialogTitle>
        <DialogDescription className="sr-only">
          Caută o locație, o organizație, o revendicare sau un tichet, ori deschide o secțiune.
        </DialogDescription>
        <Command shouldFilter={false} label="Caută în administrare" className="rounded-lg">
          <div className="pr-8">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Caută o locație, organizație, persoană, telefon sau secțiune…"
              aria-label="Caută în administrare"
              className="h-12 text-base sm:text-sm"
            />
          </div>
          <CommandList className="max-h-[min(60vh,26rem)]">
            {groups.map((group) => (
              <CommandGroup key={group.key} heading={group.total > group.items.length ? `${group.label} (${group.items.length} din ${group.total})` : group.label}>
                {group.items.map((item) => {
                  const Icon = TYPE_ICONS[item.type] || MapPin;
                  return (
                    <CommandItem key={item.key} value={item.key} onSelect={() => choose(item)} className="min-h-11 gap-3 px-3 py-2">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                      </span>
                      {item.badge && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-bold tabular-nums text-background">{item.badge}</span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {hasQuery && entityGroups.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nimic nu se potrivește cu „{query.trim()}”.</p>
            )}
            {hasQuery && loading && (
              <p role="status" className="px-4 py-4 text-center text-xs text-muted-foreground">Se încarcă datele pentru căutare…</p>
            )}
          </CommandList>
          <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>{failed.length > 0 ? `Nu am putut încărca: ${failed.join(", ")}.` : "Se caută și după telefon, email sau adresă."}</span>
            <span className="hidden items-center gap-1 sm:inline-flex"><CornerDownLeft className="h-3 w-3" aria-hidden="true" /> deschide</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
