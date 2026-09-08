import React, { useState } from "react";
import { SlidersHorizontal, Glasses, Building2, Stethoscope, Eye, Microscope, UserRound, ScanEye, WalletCards, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PROVIDER_TYPES, PROFESSIONAL_TYPES } from "@/lib/vezunde";
import { CANONICAL_SERVICE_REGISTRY } from "@/lib/canonicalServiceCatalog";

const TYPE_ICONS = { optica_medicala: Glasses, clinica_oftalmologica: Building2, cabinet_oftalmologic: Stethoscope, cabinet_optometric: Eye, laborator_optic: Microscope, optometrist_independent: UserRound, medic_oftalmolog_independent: Stethoscope };
function TypeIcon({ type }) { const Icon = TYPE_ICONS[type] || UserRound; return <Icon aria-hidden="true" strokeWidth={1.6} className="h-6 w-6" />; }
export default function SearchFilters({ providerType, professionalType, serviceKeys, casOnly, professionalMode, hasLocality, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [needle, setNeedle] = useState("");
  const count = professionalMode ? Number(Boolean(professionalType)) : providerType.split(",").filter(Boolean).length + serviceKeys.length + Number(casOnly);
  const begin = () => { setDraft({ types: providerType.split(",").filter(Boolean), profession: professionalType, services: [...serviceKeys], cas: casOnly }); setNeedle(""); setOpen(true); };
  const toggle = (field, key) => setDraft(previous => ({ ...previous, [field]: previous[field].includes(key) ? previous[field].filter(value => value !== key) : [...previous[field], key] }));
  const services = Object.entries(CANONICAL_SERVICE_REGISTRY).filter(([,definition]) => definition.patient_facing !== false && definition.b2b_only !== true && definition.label?.toLocaleLowerCase("ro").includes(needle.toLocaleLowerCase("ro")));
  const professions = Object.entries(PROFESSIONAL_TYPES).filter(([,label], index, entries) => entries.findIndex(([,other]) => other === label) === index);
  return <>
    <button type="button" onClick={begin} className="inline-flex min-h-12 shrink-0 items-center gap-2.5 rounded-full border border-[#d7dce4] bg-card px-5 text-sm font-semibold shadow-sm transition hover:border-[#4f6080] hover:bg-[#eff1f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]">
      <SlidersHorizontal className="h-4 w-4" /> Filtre {count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{count}</span>}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="viasee-filter-panel flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <div className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-3 text-xl"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eff1f5] text-[#4f6080]"><SlidersHorizontal className="h-5 w-5" aria-hidden="true" /></span> {professionalMode ? "Găsește specialistul potrivit" : "Găsește locul potrivit"}</DialogTitle>
          <DialogDescription className="mt-2">Alege ce contează pentru tine. Modificările se aplică la confirmare.</DialogDescription>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {professionalMode ? <fieldset><legend className="mb-3 font-semibold">Specializare</legend>
            <label className="my-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5]"><input type="radio" name="profession" checked={!draft.profession} onChange={() => setDraft({...draft, profession: ""})} /> Toți specialiștii</label>
            {professions.map(([key,label]) => <label key={key} className="my-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5]"><input type="radio" name="profession" checked={draft.profession === key} onChange={() => setDraft({...draft, profession:key})} />{label}</label>)}
          </fieldset> : <>
            <fieldset><legend className="mb-1 font-semibold">Tipul locației</legend><p className="mb-3 text-xs text-muted-foreground">Poți selecta mai multe tipuri.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries(PROVIDER_TYPES).map(([key,label]) => <label key={key} className="relative flex min-h-28 cursor-pointer flex-col items-start justify-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium transition hover:border-[#a7b4c9] hover:bg-[#f7f8fa] has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#4f6080]"><span className="text-[#4f6080]"><TypeIcon type={key} /></span><input className="absolute right-3 top-3 h-4 w-4 accent-[#4f6080]" type="checkbox" checked={draft.types?.includes(key) || false} onChange={() => toggle("types",key)} />{label}</label>)}</div>
            </fieldset>
            <fieldset disabled={!hasLocality} className="mt-6 border-t border-border pt-5 disabled:opacity-60">
              <legend className="flex items-center gap-2 font-semibold"><ScanEye className="h-5 w-5 text-[#4f6080]" aria-hidden="true" /> Servicii și investigații</legend>
              {!hasLocality ? <p className="mt-2 text-sm text-muted-foreground">Alege mai întâi localitatea din bara de căutare pentru servicii și CAS.</p> : <p className="mt-2 text-xs text-muted-foreground">Afișăm locații cu cel puțin unul dintre serviciile selectate, publicat și eligibil.</p>}
              <div className="relative my-3"><Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input aria-label="Caută un serviciu în filtre" value={needle} onChange={e => setNeedle(e.target.value)} placeholder="Caută: consultație, OCT, câmp vizual..." className="min-h-11 w-full rounded-full border border-border bg-[#f7f8fa] pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-[#4f6080]" /></div>
              <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-2xl bg-[#f7f8fa] p-2 sm:grid-cols-2">
                {services.map(([key,definition]) => <label key={key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-white has-[:checked]:bg-[#e6ebf3]"><input className="h-4 w-4 shrink-0 accent-[#4f6080]" type="checkbox" checked={draft.services?.includes(key) || false} onChange={() => toggle("services",key)} />{definition.label}</label>)}
                {!services.length && <p className="p-3 text-sm">Niciun serviciu cu această denumire.</p>}
              </div>
              <label className="mt-5 flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-[#d8dfeb] bg-[#eff1f5] px-4 py-3 text-sm font-semibold"><WalletCards className="h-6 w-6 shrink-0 text-[#4f6080]" aria-hidden="true" /><input className="h-4 w-4 accent-[#4f6080]" type="checkbox" checked={draft.cas || false} onChange={e => setDraft({...draft, cas:e.target.checked})} /> Servicii marcate ca decontate CAS</label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Marcajul trebuie să existe pe serviciul selectat. Confirmă condițiile și disponibilitatea fondurilor cu locația.</p>
            </fieldset>
          </>}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          <button type="button" onClick={() => setDraft({types:[],profession:"",services:[],cas:false})} className="min-h-11 text-sm underline">Resetează filtrele</button>
          <button type="button" onClick={() => { onApply({providerType:draft.types.join(","),professionalType:draft.profession,serviceKeys:hasLocality?draft.services:[],casOnly:hasLocality&&draft.cas}); setOpen(false); }} className="min-h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">Arată rezultatele</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
