import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { AVAILABILITY_OPTIONS } from "@/lib/providerTaxonomy";
import { validateProviderOpeningHours } from "../../../../shared/providerOpeningHours.js";
import LocationEditorSteps from "./LocationEditorSteps";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

const DAYS = [
  ["monday", "Luni"],
  ["tuesday", "Marți"],
  ["wednesday", "Miercuri"],
  ["thursday", "Joi"],
  ["friday", "Vineri"],
  ["saturday", "Sâmbătă"],
  ["sunday", "Duminică"],
];

const DEFAULT_WEEKLY = {
  monday: { open: true, from: "09:00", to: "18:00" },
  tuesday: { open: true, from: "09:00", to: "18:00" },
  wednesday: { open: true, from: "09:00", to: "18:00" },
  thursday: { open: true, from: "09:00", to: "18:00" },
  friday: { open: true, from: "09:00", to: "18:00" },
  saturday: { open: true, from: "09:00", to: "14:00" },
  sunday: { open: false, from: "", to: "" },
};

const ACCESS_MODE_HELP = {
  necunoscuta: "Informația nu va fi afișată public.",
  astazi: "Clienții și pacienții pot veni direct, fără programare prealabilă.",
  urmatoarele_zile:
    "Locația acceptă atât vizite fără programare, cât și vizite programate.",
  saptamana_aceasta:
    "Serviciile de optică sunt disponibile fără programare, iar consultațiile se fac cu programare.",
  doar_programare: "Toate vizitele se fac numai cu programare.",
};

function safeParse(raw) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function normalizeWeekly(raw = {}) {
  return Object.fromEntries(
    DAYS.map(([key]) => [key, { ...DEFAULT_WEEKLY[key], ...(raw[key] || {}) }]),
  );
}

function initialState(location = {}) {
  const parsed = safeParse(location.opening_hours_json);
  return {
    weekly: normalizeWeekly(parsed.weekly),
    exceptions: Array.isArray(parsed.exceptions) ? parsed.exceptions : [],
    availability_status: location.availability_status || "necunoscuta",
  };
}

function normalizeTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  let hh = "";
  let mm = "";

  if (/^\d{1,2}:\d{1,2}$/.test(raw)) {
    [hh, mm] = raw.split(":");
  } else if (digits.length === 1 || digits.length === 2) {
    hh = digits;
    mm = "00";
  } else if (digits.length === 3) {
    hh = digits.slice(0, 1);
    mm = digits.slice(1);
  } else if (digits.length >= 4) {
    hh = digits.slice(0, 2);
    mm = digits.slice(2, 4);
  } else {
    return raw;
  }

  const h = Number(hh);
  const m = Number(mm);
  if (
    !Number.isInteger(h) ||
    !Number.isInteger(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return raw;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TimeField({ value, disabled, onChange, label, placeholder = "09:00" }) {
  return (
    <input
      aria-label={label}
      type="text"
      inputMode="numeric"
      maxLength={5}
      disabled={disabled}
      className={`${inputCls} font-mono tabular-nums disabled:opacity-50`}
      value={value || ""}
      placeholder={placeholder}
      onChange={(event) =>
        onChange(event.target.value.replace(/[^0-9:]/g, "").slice(0, 5))
      }
      onBlur={(event) => onChange(normalizeTime(event.target.value))}
    />
  );
}

function formatDay(day) {
  if (!day?.open) return "Închis";
  if (!day.from || !day.to) return "Program necompletat";
  return `${normalizeTime(day.from)} - ${normalizeTime(day.to)}`;
}

function formatWeeklyText(weekly) {
  const weekdayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const weekdayText = weekdayKeys.map((key) => formatDay(weekly[key]));
  const allSame = weekdayText.every((value) => value === weekdayText[0]);
  const weekdayLabel = allSame
    ? `Luni-Vineri: ${weekdayText[0]}`
    : weekdayKeys.map((key, index) => `${DAYS[index][1]}: ${weekdayText[index]}`).join("; ");
  return `${weekdayLabel}; Sâmbătă: ${formatDay(weekly.saturday)}; Duminică: ${formatDay(weekly.sunday)}`;
}

function formatSaturdayText(weekly) {
  return formatDay(weekly.saturday);
}

function nextException(exceptions) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return (
    [...exceptions]
      .filter((item) => item.end_date >= today)
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0] || null
  );
}

function ExceptionRow({ item, index, onChange, onRemove }) {
  const closed = item.type === "closed";
  return (
    <div className="border-t border-border/70 py-4 first:border-t-0 first:pt-0">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Tip</label>
          <select
            aria-label={`Tip excepție ${index + 1}`}
            className={`${inputCls} mt-1`}
            value={item.type || "closed"}
            onChange={(event) => onChange(index, { ...item, type: event.target.value })}
          >
            <option value="closed">Închis</option>
            <option value="custom">Program special</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">De la</label>
          <input
            type="date"
            aria-label={`Data de final pentru excepția ${index + 1}`}
            className={`${inputCls} mt-1`}
            value={item.start_date || ""}
            onChange={(event) => onChange(index, { ...item, start_date: event.target.value })}
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Până la</label>
          <input
            type="date"
            className={`${inputCls} mt-1`}
            value={item.end_date || ""}
            onChange={(event) => onChange(index, { ...item, end_date: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">De la ora</label>
            <div className="mt-1">
              <TimeField
                label={`Ora de deschidere pentru excepția ${index + 1}`}
                disabled={closed}
                value={item.from || ""}
                onChange={(value) => onChange(index, { ...item, from: value })}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Până la</label>
            <div className="mt-1">
              <TimeField
                label={`Ora de închidere pentru excepția ${index + 1}`}
                disabled={closed}
                value={item.to || ""}
                onChange={(value) => onChange(index, { ...item, to: value })}
                placeholder="18:00"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 hover:bg-secondary"
          aria-label={`Șterge excepția ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3">
        <label className="text-[11px] font-semibold text-muted-foreground">
          Mesaj public, opțional
        </label>
        <input
          className={`${inputCls} mt-1`}
          aria-label={`Mesaj public pentru excepția ${index + 1}`}
          maxLength={300}
          value={item.public_note || ""}
          onChange={(event) => onChange(index, { ...item, public_note: event.target.value })}
          placeholder="Ex: Închis de sărbători / Program special de inventar"
        />
      </div>
    </div>
  );
}

export default function ProviderHours({ locationId, location = {}, onRefresh, onDirtyChange }) {
  const [state, setState] = useState(() => initialState(location));
  const [savedSignature, setSavedSignature] = useState(() => location.opening_hours_json ? JSON.stringify(initialState(location)) : "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState("weekly");
  const savingRef = useRef(false);
  const signature = JSON.stringify(state);
  const dirty = signature !== savedSignature;
  const upcoming = useMemo(() => nextException(state.exceptions), [state.exceptions]);
  const weeklyText = useMemo(() => formatWeeklyText(state.weekly), [state.weekly]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  // Copying a saved schedule to this location refreshes the editor only when it has no local edits.
  useEffect(() => {
    if (dirty || saving) return;
    const next = initialState(location);
    setState(next);
    setSavedSignature(location.opening_hours_json ? JSON.stringify(next) : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.opening_hours_json, location.availability_status]);

  const update = callback => { setError(""); setMsg(""); setState(callback); };
  const updateDay = (key, patch) => update(current => ({ ...current, weekly: { ...current.weekly, [key]: { ...current.weekly[key], ...patch } } }));
  const applyPreset = preset => update(current => {
    if (preset === "standard") return { ...current, weekly: normalizeWeekly(DEFAULT_WEEKLY) };
    if (preset === "copy_monday") return { ...current, weekly: Object.fromEntries(DAYS.map(([key]) => [key, ["tuesday","wednesday","thursday","friday"].includes(key) ? { ...current.weekly.monday } : current.weekly[key]])) };
    return { ...current, weekly: { ...current.weekly, saturday: { open:false, from:"", to:"" }, sunday: { open:false, from:"", to:"" } } };
  });
  const addException = () => update(current => ({ ...current, exceptions: [...current.exceptions, { type:"closed", start_date:"", end_date:"", from:"", to:"", public_note:"" }] }));
  const updateException = (index, item) => update(current => ({ ...current, exceptions: current.exceptions.map((old, i) => i === index ? item : old) }));
  const removeException = index => update(current => ({ ...current, exceptions: current.exceptions.filter((_, i) => i !== index) }));

  const save = async () => {
    if (savingRef.current) return;
    setError(""); setMsg("");
    const normalizedWeekly = Object.fromEntries(DAYS.map(([key]) => [key, state.weekly[key].open
      ? { open:true, from:normalizeTime(state.weekly[key].from), to:normalizeTime(state.weekly[key].to) }
      : { open:false, from:"", to:"" }]));
    const normalizedExceptions = state.exceptions.map(item => ({ ...item, from:item.type === "closed" ? "" : normalizeTime(item.from), to:item.type === "closed" ? "" : normalizeTime(item.to) }));
    const checked = validateProviderOpeningHours({ weekly:normalizedWeekly, exceptions:normalizedExceptions });
    if (!checked.valid) { setError(checked.error); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await base44.functions.invoke("saveProviderRoutineProfile", {
        location_id:locationId,
        opening_hours_json:JSON.stringify(checked.value),
        opening_hours:formatWeeklyText(checked.value.weekly),
        saturday_hours:formatSaturdayText(checked.value.weekly),
        availability_status:state.availability_status,
        availability_updated_at:new Date().toISOString(),
      });
      if (response.data?.error) throw new Error(response.data.error);
      if (response.data?.success !== true) throw new Error("Salvarea nu a fost confirmată. Încearcă din nou.");
      const next = { ...checked.value, availability_status:state.availability_status };
      setState(next); setSavedSignature(JSON.stringify(next));
      setMsg("Programul și modul de primire au fost salvate.");
      onRefresh?.();
    } catch (requestError) { setError(requestError.response?.data?.error || requestError.message || "Programul nu a putut fi salvat."); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const steps = [
    { id:"weekly", label:"Program săptămânal", detail:"Orele fiecărei zile" },
    { id:"exceptions", label:"Program special", detail:state.exceptions.length ? state.exceptions.length + (state.exceptions.length === 1 ? " excepție" : " excepții") : "Opțional" },
    { id:"review", label:"Verifică și salvează", detail:"Previzualizare și acces" },
  ];

  return <div className="location-editor hours-editor">
    <LocationEditorSteps label="Configurarea programului" steps={steps} active={step} onChange={setStep} disabled={saving} />
    {!location.opening_hours_json && <p className="location-editor-notice">Orele de mai jos sunt un punct de plecare. Verifică-le înainte de prima salvare.{location.opening_hours && <> Programul actual: {location.opening_hours}</>}</p>}
    <fieldset disabled={saving} className="location-editor-panel">
      <section hidden={step !== "weekly"} aria-label="Program săptămânal">
        <h2>În ce interval este deschisă locația?</h2>
        <p className="location-editor-intro">Alege Deschis sau Închis pentru fiecare zi. Orele se completează în format 24h.</p>
        <div className="hours-editor-presets">
          <button type="button" onClick={() => applyPreset("standard")}>Program standard</button>
          <button type="button" onClick={() => applyPreset("copy_monday")}>Copiază luni în marți–vineri</button>
          <button type="button" onClick={() => applyPreset("weekend_closed")}>Weekend închis</button>
        </div>
        <div className="hours-editor-days">
          {DAYS.map(([key,label]) => {
            const day = state.weekly[key];
            return <div key={key} className="hours-editor-day">
              <strong className="hours-editor-day__name">{label}</strong>
              <div><label htmlFor={`hours-${locationId}-${key}`}>Stare</label><select id={`hours-${locationId}-${key}`} aria-label={`Stare ${label}`} className={inputCls} value={day.open ? "open" : "closed"} onChange={event => updateDay(key, event.target.value === "open" ? { open:true, from:day.from || "09:00", to:day.to || "18:00" } : { open:false, from:"", to:"" })}>
                <option value="open">Deschis</option><option value="closed">Închis</option>
              </select></div>
              <div><label>Deschidere</label><TimeField label={`Deschidere ${label}`} disabled={!day.open} value={day.from} onChange={value => updateDay(key,{from:value})} /></div>
              <div><label>Închidere</label><TimeField label={`Închidere ${label}`} disabled={!day.open} value={day.to} onChange={value => updateDay(key,{to:value})} placeholder="18:00" /></div>
            </div>;
          })}
        </div>
      </section>
      <section hidden={step !== "exceptions"} aria-label="Program special">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2>Sărbători, concedii sau program redus</h2><p className="location-editor-intro">Setează o perioadă temporară. La final, se folosește din nou programul săptămânal.</p></div>
          <button type="button" className="location-editor-button" onClick={addException}><Plus /> Adaugă excepție</button>
        </div>
        <div className="mt-6">
          {state.exceptions.length === 0 ? <p className="location-editor-notice">Nu ai excepții. Poți continua direct la verificare.</p>
            : state.exceptions.map((item,index) => <ExceptionRow key={index} item={item} index={index} onChange={updateException} onRemove={removeException} />)}
        </div>
      </section>
      <section hidden={step !== "review"} aria-label="Verifică programul">
        <h2>Verifică informațiile afișate clienților</h2>
        <p className="location-editor-intro">Salvarea actualizează programul locației. {location.active_status === "inactiva" ? "Locația este inactivă și nu apare public." : "Dacă profilul locației este public, noul program apare imediat."}</p>
        <div className="hours-editor-preview mt-5">
          <div><h3 className="text-sm font-bold">Program săptămânal</h3><dl>{DAYS.map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{formatDay(state.weekly[key])}</dd></div>)}</dl><p className="location-editor-intro mt-3">{upcoming ? `Următoarea excepție: ${upcoming.start_date} – ${upcoming.end_date} · ${upcoming.type === "closed" ? "Închis" : formatDay({open:true,...upcoming})}` : "Nu există excepții viitoare."}</p></div>
          <div><label htmlFor={`access-mode-${locationId}`} className="text-sm font-bold">Cum primesc clienții serviciile?</label><p className="location-editor-intro">Opțional. Alege dacă vizita necesită programare.</p>
            <select id={`access-mode-${locationId}`} className={`${inputCls} mt-4`} value={state.availability_status} onChange={event => update(current => ({...current,availability_status:event.target.value}))}>
              <option value="necunoscuta">Nu afișa această informație</option>
              {Object.entries(AVAILABILITY_OPTIONS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
            </select><p className="location-editor-intro">{ACCESS_MODE_HELP[state.availability_status] || ACCESS_MODE_HELP.necunoscuta}</p>
          </div>
        </div>
      </section>
    </fieldset>
    {error && <p className="location-editor-notice" role="alert">{error}</p>}
    <footer className="location-editor-actions">
      <div className="location-editor-actions__status" role="status">{saving ? "Se salvează…" : msg || (dirty ? "Ai modificări nesalvate" : "Programul este la zi")}</div>
      <div className="location-editor-actions__buttons">
        {step !== "weekly" && <button type="button" disabled={saving} className="location-editor-button" onClick={() => setStep(step === "review" ? "exceptions" : "weekly")}><ArrowLeft /> Înapoi</button>}
        {step !== "review" ? <button type="button" disabled={saving} className="location-editor-button location-editor-button--primary" onClick={() => setStep(step === "weekly" ? "exceptions" : "review")}>Continuă <ArrowRight /></button>
          : <button type="button" disabled={saving || !dirty} onClick={save} className="location-editor-button location-editor-button--primary"><Save /> {saving ? "Se salvează…" : "Salvează programul"}</button>}
      </div>
    </footer>
  </div>;
}
