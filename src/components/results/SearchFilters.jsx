import React, { useMemo, useState } from "react";
import { SlidersHorizontal, Glasses, Building2, Stethoscope, Eye, Microscope, UserRound, ScanEye, WalletCards, Search, ChevronDown, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PROVIDER_TYPES, PROFESSIONAL_TYPES } from "@/lib/vezunde";
import { SERVICE_GROUP_UI, getServiceLabel, patientServicesByGroup, serviceMatchesNeedle } from "@/lib/serviceAutocomplete";

const TYPE_ICONS = { optica_medicala: Glasses, clinica_oftalmologica: Building2, cabinet_oftalmologic: Stethoscope, cabinet_optometric: Eye, laborator_optic: Microscope, optometrist_independent: UserRound, medic_oftalmolog_independent: Stethoscope };
function TypeIcon({ type }) { const Icon = TYPE_ICONS[type] || UserRound; return <Icon aria-hidden="true" strokeWidth={1.7} className="h-5 w-5 shrink-0" />; }

// Panoul de filtre de pe /cauta. Ce se aplica e neschimbat (tipuri, servicii, CAS, la confirmare);
// s-a schimbat doar felul in care se aleg:
// - tipurile de locatie sunt randuri compacte, nu carduri mari;
// - cele 136 de servicii sunt pe grupuri care se deschid, nu o lista plata cu derulare in derulare;
// - serviciile bifate apar sus, ca etichete care se pot scoate dintr-un click.
export default function SearchFilters({ providerType, professionalType, serviceKeys, casOnly, professionalMode, hasLocality, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [needle, setNeedle] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const count = professionalMode ? Number(Boolean(professionalType)) : providerType.split(",").filter(Boolean).length + serviceKeys.length + Number(casOnly);
  const groups = useMemo(() => patientServicesByGroup(), []);
  const begin = () => {
    const services = [...serviceKeys];
    setDraft({ types: providerType.split(",").filter(Boolean), profession: professionalType, services, cas: casOnly });
    setNeedle("");
    setExpanded(new Set(groups.filter(([, items]) => items.some((item) => services.includes(item.service_key))).map(([group]) => group)));
    setOpen(true);
  };
  const toggle = (field, key) => setDraft(previous => ({ ...previous, [field]: previous[field].includes(key) ? previous[field].filter(value => value !== key) : [...previous[field], key] }));
  const toggleGroup = (group) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });
  const searching = needle.trim().length > 0;
  const visibleGroups = groups
    .map(([group, items]) => [group, searching ? items.filter((item) => serviceMatchesNeedle(item.service_key, needle)) : items])
    .filter(([, items]) => items.length > 0);
  const professions = Object.entries(PROFESSIONAL_TYPES).filter(([,label], index, entries) => entries.findIndex(([,other]) => other === label) === index);
  const draftCount = professionalMode ? Number(Boolean(draft.profession)) : (draft.types?.length || 0) + (hasLocality ? (draft.services?.length || 0) + Number(Boolean(draft.cas)) : 0);

  return <>
    <button type="button" onClick={begin} className="inline-flex min-h-12 shrink-0 items-center gap-2.5 rounded-full border border-[#d7dce4] bg-card px-5 text-sm font-semibold shadow-sm transition hover:border-[#4f6080] hover:bg-[#eff1f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]">
      <SlidersHorizontal className="h-4 w-4" /> Filtre {count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{count}</span>}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="viasee-filter-panel flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <div className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-3 text-xl"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eff1f5] text-[#4f6080]"><SlidersHorizontal className="h-5 w-5" aria-hidden="true" /></span> {professionalMode ? "Filtrează specialiștii" : "Filtrează locațiile"}</DialogTitle>
          <DialogDescription className="mt-2">Alege ce contează pentru tine. Rezultatele se actualizează când apeși „Arată rezultatele”.</DialogDescription>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {professionalMode ? <fieldset><legend className="mb-3 font-semibold">Specializare</legend>
            <label className="my-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5]"><input type="radio" name="profession" checked={!draft.profession} onChange={() => setDraft({...draft, profession: ""})} /> Toți specialiștii</label>
            {professions.map(([key,label]) => <label key={key} className="my-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5]"><input type="radio" name="profession" checked={draft.profession === key} onChange={() => setDraft({...draft, profession:key})} />{label}</label>)}
          </fieldset> : <>
            <fieldset>
              <legend className="mb-1 font-semibold">Tipul locației</legend>
              <p className="mb-3 text-xs text-muted-foreground">Poți alege mai multe. Fără nicio alegere, apar toate tipurile.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(PROVIDER_TYPES).map(([key,label]) => {
                  const checked = draft.types?.includes(key) || false;
                  return <label key={key} className="relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-[#a7b4c9] hover:bg-[#f7f8fa] has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#4f6080]">
                    <input className="sr-only" type="checkbox" checked={checked} onChange={() => toggle("types",key)} />
                    <span className="text-[#4f6080]"><TypeIcon type={key} /></span>
                    <span className="min-w-0 flex-1">{label}</span>
                    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-[#4f6080] bg-[#4f6080] text-white" : "border-[#c5ccd8] bg-white"}`}>{checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                  </label>;
                })}
              </div>
            </fieldset>

            <fieldset disabled={!hasLocality} className="mt-6 border-t border-border pt-5 disabled:opacity-60">
              <legend className="flex items-center gap-2 font-semibold"><ScanEye className="h-5 w-5 text-[#4f6080]" aria-hidden="true" /> Servicii oferite</legend>
              {!hasLocality
                ? <p className="mt-2 text-sm text-muted-foreground">Alege mai întâi localitatea din bara de căutare. Apoi poți filtra după servicii și decontare CAS.</p>
                : <p className="mt-2 text-xs text-muted-foreground">Apar locațiile care oferă cel puțin unul dintre serviciile bifate.</p>}

              {hasLocality && draft.services?.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Servicii bifate">
                {draft.services.map((key) => <button key={key} type="button" onClick={() => toggle("services", key)} aria-label={`Scoate ${getServiceLabel(key)}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#4f6080] px-3 text-xs font-medium text-white hover:bg-[#3f4e6a]">{getServiceLabel(key)}<X className="h-3.5 w-3.5" aria-hidden="true" /></button>)}
              </div>}

              <div className="relative my-3">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input aria-label="Caută un serviciu în filtre" value={needle} onChange={e => setNeedle(e.target.value)} placeholder="Caută: consultație, OCT, lentile, reparații..." className="min-h-11 w-full rounded-full border border-border bg-[#f7f8fa] pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-[#4f6080] sm:text-sm" />
              </div>

              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {visibleGroups.map(([group, items]) => {
                  const isOpen = searching || expanded.has(group);
                  const selectedHere = items.filter((item) => draft.services?.includes(item.service_key)).length;
                  const panelId = `filter-group-${group}`;
                  return <div key={group}>
                    <button type="button" onClick={() => toggleGroup(group)} aria-expanded={isOpen} aria-controls={panelId} disabled={searching} className="flex min-h-12 w-full items-center gap-3 bg-card px-4 py-2 text-left text-sm font-semibold transition hover:bg-[#f7f8fa] disabled:cursor-default disabled:hover:bg-card">
                      <span className="min-w-0 flex-1">{SERVICE_GROUP_UI[group]?.title || group}</span>
                      {selectedHere > 0 && <span className="rounded-full bg-[#4f6080] px-2 py-0.5 text-[11px] text-white">{selectedHere}</span>}
                      <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
                      {!searching && <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />}
                    </button>
                    {isOpen && <div id={panelId} className="grid grid-cols-1 gap-0.5 bg-[#f7f8fa] p-2 sm:grid-cols-2">
                      {items.map((item) => <label key={item.service_key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-white has-[:checked]:bg-[#e6ebf3]">
                        <input className="h-4 w-4 shrink-0 accent-[#4f6080]" type="checkbox" checked={draft.services?.includes(item.service_key) || false} onChange={() => toggle("services", item.service_key)} />
                        {item.label}
                      </label>)}
                    </div>}
                  </div>;
                })}
                {!visibleGroups.length && <p className="p-4 text-sm">Niciun serviciu cu această denumire.</p>}
              </div>

              <label className="mt-5 flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-[#d8dfeb] bg-[#eff1f5] px-4 py-3 text-sm font-semibold"><WalletCards className="h-6 w-6 shrink-0 text-[#4f6080]" aria-hidden="true" /><input className="h-4 w-4 accent-[#4f6080]" type="checkbox" checked={draft.cas || false} onChange={e => setDraft({...draft, cas:e.target.checked})} /> Servicii marcate ca decontate CAS</label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Marcajul trebuie să existe pe serviciul selectat. Confirmă condițiile și disponibilitatea fondurilor cu locația.</p>
            </fieldset>
          </>}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          <button type="button" onClick={() => setDraft({types:[],profession:"",services:[],cas:false})} className="min-h-11 text-sm underline">Resetează filtrele</button>
          <button type="button" onClick={() => { onApply({providerType:draft.types.join(","),professionalType:draft.profession,serviceKeys:hasLocality?draft.services:[],casOnly:hasLocality&&draft.cas}); setOpen(false); }} className="min-h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">Arată rezultatele{draftCount > 0 ? ` · ${draftCount} ${draftCount === 1 ? "filtru" : "filtre"}` : ""}</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
