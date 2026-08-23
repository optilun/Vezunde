// Faza 2: propunerea manuala de serviciu, la finalul unui grup.
import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { cleanText } from "./servicesConfigModel";
import { inputClass } from "./servicesUiTokens";

export default function CustomSuggestion({ unitKey, section, disabled, items, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const submit = () => {
    const clean = cleanText(label);
    if (!clean) return;
    onAdd({
      group: section.items[0]?.group || "optical_retail",
      label: clean,
      note: "Propus din workspace furnizor",
      functional_unit_key: unitKey,
      capability_key: section.capabilityKey || "",
    });
    setLabel("");
    setOpen(false);
  };
  return (
    <div className="border-t border-border/60 px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={disabled} onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Nu găsești opțiunea? Propune manual</button>
      </div>
      {open && (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Propunerea primește status propriu și nu intră în profil sau matching până la clasificare.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className={inputClass} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Denumirea produsului sau serviciului" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} /><button type="button" onClick={submit} className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Adaugă în draft</button></div>
        </>
      )}
      {items.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{items.map((item, index) => <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#e1bda8] bg-[#efd5c5] px-3 py-1.5 text-xs font-semibold text-black/70">{item.label}<button type="button" disabled={disabled} onClick={() => onRemove(item)} className="services-chip__remove rounded-full p-0.5 hover:bg-[#efd5c5]"><X className="h-3 w-3" /></button></span>)}</div>}
    </div>
  );
}