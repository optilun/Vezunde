import React, { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PROVIDER_TYPES, PROFESSIONAL_TYPES } from "@/lib/vezunde";
import { CANONICAL_SERVICE_REGISTRY } from "@/lib/canonicalServiceCatalog";

export default function SearchFilters({ providerType, professionalType, serviceKeys, casOnly, professionalMode, hasLocality, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [needle, setNeedle] = useState("");
  const count = professionalMode ? Number(Boolean(professionalType)) : providerType.split(",").filter(Boolean).length + serviceKeys.length + Number(casOnly);
  const begin = () => { setDraft({ types: providerType.split(",").filter(Boolean), profession: professionalType, services: [...serviceKeys], cas: casOnly }); setNeedle(""); setOpen(true); };
  const toggle = (field, key) => setDraft(previous => ({ ...previous, [field]: previous[field].includes(key) ? previous[field].filter(value => value !== key) : [...previous[field], key] }));
  const services = Object.entries(CANONICAL_SERVICE_REGISTRY).filter(([,definition]) => definition.label?.toLocaleLowerCase("ro").includes(needle.toLocaleLowerCase("ro")));
  const professions = Object.entries(PROFESSIONAL_TYPES).filter(([,label], index, entries) => entries.findIndex(([,other]) => other === label) === index);
  return <>
    <button type="button" onClick={begin} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary">
      <SlidersHorizontal className="h-4 w-4" /> Filtre {count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{count}</span>}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <div className="border-b border-border px-6 py-5">
          <DialogTitle>Filtrează rezultatele</DialogTitle>
          <DialogDescription className="mt-2">Alege ce contează pentru tine. Modificările se aplică la confirmare.</DialogDescription>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {professionalMode ? <fieldset><legend className="mb-3 font-semibold">Specializare</legend>
            <label className="flex min-h-11 items-center gap-3"><input type="radio" name="profession" checked={!draft.profession} onChange={() => setDraft({...draft, profession: ""})} /> Toți specialiștii</label>
            {professions.map(([key,label]) => <label key={key} className="flex min-h-11 items-center gap-3"><input type="radio" name="profession" checked={draft.profession === key} onChange={() => setDraft({...draft, profession:key})} />{label}</label>)}
          </fieldset> : <>
            <fieldset><legend className="mb-1 font-semibold">Tipul locației</legend><p className="mb-3 text-xs text-muted-foreground">Poți selecta mai multe tipuri.</p>
              <div className="grid gap-2 sm:grid-cols-2">{Object.entries(PROVIDER_TYPES).map(([key,label]) => <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5]"><input type="checkbox" checked={draft.types?.includes(key) || false} onChange={() => toggle("types",key)} />{label}</label>)}</div>
            </fieldset>
            <fieldset disabled={!hasLocality} className="mt-6 border-t border-border pt-5 disabled:opacity-60">
              <legend className="font-semibold">Servicii și investigații</legend>
              {!hasLocality ? <p className="mt-2 text-sm text-muted-foreground">Alege mai întâi localitatea din bara de căutare pentru servicii și CAS.</p> : <p className="mt-2 text-xs text-muted-foreground">Afișăm locații cu cel puțin unul dintre serviciile selectate, publicat și eligibil.</p>}
              <input aria-label="Caută un serviciu în filtre" value={needle} onChange={e => setNeedle(e.target.value)} placeholder="Caută: consultație, OCT, câmp vizual..." className="my-3 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base" />
              <div className="max-h-52 overflow-y-auto rounded-xl border border-border p-2">
                {services.map(([key,definition]) => <label key={key} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-secondary"><input type="checkbox" checked={draft.services?.includes(key) || false} onChange={() => toggle("services",key)} />{definition.label}</label>)}
                {!services.length && <p className="p-3 text-sm">Niciun serviciu cu această denumire.</p>}
              </div>
              <label className="mt-5 flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" checked={draft.cas || false} onChange={e => setDraft({...draft, cas:e.target.checked})} /> Servicii marcate ca decontate CAS</label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Marcajul trebuie să existe pe serviciul selectat. Confirmă condițiile și disponibilitatea fondurilor cu locația.</p>
            </fieldset>
          </>}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          <button type="button" onClick={() => setDraft({types:[],profession:"",services:[],cas:false})} className="min-h-11 text-sm underline">Resetează filtrele</button>
          <button type="button" onClick={() => { onApply({providerType:draft.types.join(","),professionalType:draft.profession,serviceKeys:hasLocality?draft.services:[],casOnly:hasLocality&&draft.cas}); setOpen(false); }} className="min-h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">Aplică filtrele</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
