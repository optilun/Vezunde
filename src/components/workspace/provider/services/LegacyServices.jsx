// Faza 2: cheile vechi de servicii care necesita migrare.
import React, { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

export default function LegacyServices({ services, rawRemovalKeys, disabled, onToggle, dataAttrs = {} }) {
  const [open, setOpen] = useState(false);
  if (!services.length) return null;
  return (
    <section {...dataAttrs} className="overflow-hidden rounded-[22px] border border-[#e1bda8] bg-[#efd5c5]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"><AlertTriangle className="h-4 w-4 text-black/70" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#1c1c1c]">Date existente care necesită migrare</span><span className="text-[11px] text-black/55">{services.length} chei vechi, ambigue sau necunoscute</span></span><ChevronDown className={`h-4 w-4 text-black/70 transition ${open ? "rotate-180" : ""}`} /></button>
      {open && <div className="space-y-2 border-t border-[#e1bda8] p-4 sm:p-5">{services.map((service) => { const marked = rawRemovalKeys.includes(service.raw_key); return <div key={`${service.id}:${service.raw_key}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e1bda8] bg-white px-3 py-2.5"><div><div className="text-xs font-bold">{service.label || service.raw_key}</div><div className="mt-1 text-[10px] text-muted-foreground">{service.raw_key}</div></div><button type="button" disabled={disabled} onClick={() => onToggle(service.raw_key)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${marked ? "border-[#e1bda8] bg-[#efd5c5] text-black/70" : "border-border bg-background"}`}>{marked ? "Eliminare propusă" : "Propune eliminarea"}</button></div>; })}</div>}
    </section>
  );
}