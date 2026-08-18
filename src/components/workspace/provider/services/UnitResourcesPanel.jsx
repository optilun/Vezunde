// Faza 2: resursele asociate unei zone (specialisti, echipamente, facilitati).
import React, { useState } from "react";
import { Check, ChevronDown, Users, X } from "lucide-react";
import { ChangeBadge } from "./ServiceBadges";

function ResourceGroup({ title, emptyText, items, unitKey, type, disabled, links, approvedLinks, onToggle }) {
  if (items.length === 0) return <div className="rounded-xl border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground"><strong className="text-foreground">{title}</strong><div className="mt-1">{emptyText}</div></div>;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs font-bold">{title}</div>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => {
          const id = item.id;
          const assigned = type === "professionals"
            ? (links.professionals.find((link) => link.assignment_id === id)?.unit_keys || []).includes(unitKey)
            : links[type].some((link) => link[`${type === "equipment" ? "equipment" : "facility"}_id`] === id && link.unit_key === unitKey);
          const approvedAssigned = type === "professionals"
            ? (approvedLinks.professionals.find((link) => link.assignment_id === id)?.unit_keys || []).includes(unitKey)
            : approvedLinks[type].some((link) => link[`${type === "equipment" ? "equipment" : "facility"}_id`] === id && link.unit_key === unitKey);
          const removalRequested = approvedAssigned && !assigned;
          const draftAddition = assigned && !approvedAssigned;
          const label = type === "professionals" ? `${item.full_name} · ${item.professional_type || "specialist"}`
            : type === "equipment" ? item.equipment_label
              : item.facility_key;
          return (
            <button key={id} type="button" disabled={disabled} onClick={() => onToggle(type, id, unitKey)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs disabled:opacity-60 ${removalRequested ? "bg-amber-50 hover:bg-amber-50" : "hover:bg-secondary/40"}`}>
              <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${removalRequested ? "border-amber-300 bg-amber-100 text-amber-900" : assigned ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>{removalRequested ? <X className="h-3 w-3" /> : assigned && <Check className="h-3 w-3" />}</span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
              {item.verification_status && !removalRequested && !draftAddition && <span className="text-[10px] text-muted-foreground">{item.verification_status}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function UnitResourcesPanel({ unitKey, config, disabled, links, approvedLinks, onToggle }) {
  const [open, setOpen] = useState(false);
  const professionalCount = (links.professionals || []).filter((item) => (item.unit_keys || []).includes(unitKey)).length;
  const equipmentCount = (links.equipment || []).filter((item) => item.unit_key === unitKey).length;
  const facilityCount = (links.facilities || []).filter((item) => item.unit_key === unitKey).length;
  const resourceCount = professionalCount + equipmentCount + facilityCount;
  return (
    <div className="border-t border-border/60 bg-secondary/10">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-xs font-bold">Resurse asociate zonei</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">{resourceCount > 0 ? `${professionalCount} specialiști · ${equipmentCount} echipamente · ${facilityCount} facilități` : "Nicio resursă asociată încă"}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {resourceCount > 0 && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">{resourceCount} asociate</span>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border/60 p-4 md:grid-cols-3 sm:p-5">
          <ResourceGroup title="Specialiști" emptyText="Nu există specialiști activi asociați locației." items={config.assignments || []} unitKey={unitKey} type="professionals" disabled={disabled} links={links} approvedLinks={approvedLinks} onToggle={onToggle} />
          <ResourceGroup title="Echipamente" emptyText="Nu există echipamente declarate." items={(config.equipment || []).filter((item) => item.is_active !== false)} unitKey={unitKey} type="equipment" disabled={disabled} links={links} approvedLinks={approvedLinks} onToggle={onToggle} />
          <ResourceGroup title="Facilități" emptyText="Nu există facilități declarate." items={(config.facilities || []).filter((item) => item.is_active !== false)} unitKey={unitKey} type="facilities" disabled={disabled} links={links} approvedLinks={approvedLinks} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}