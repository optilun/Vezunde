import React, { useMemo, useState } from "react";
import { CalendarDays, Plus, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { AVAILABILITY_OPTIONS } from "@/lib/providerTaxonomy";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

const DAYS = [
  ["monday", "Luni"],
  ["tuesday", "Marti"],
  ["wednesday", "Miercuri"],
  ["thursday", "Joi"],
  ["friday", "Vineri"],
  ["saturday", "Sambata"],
  ["sunday", "Duminica"],
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

function safeParse(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

function normalizeWeekly(raw = {}) {
  return Object.fromEntries(DAYS.map(([key]) => [key, { ...DEFAULT_WEEKLY[key], ...(raw[key] || {}) }]));
}

function initialState(location = {}) {
  const parsed = safeParse(location.opening_hours_json);
  return {
    weekly: normalizeWeekly(parsed.weekly),
    exceptions: Array.isArray(parsed.exceptions) ? parsed.exceptions : [],
    availability_status: location.availability_status || "necunoscuta",
  };
}

function formatDay(day) {
  if (!day?.open) return "Inchis";
  if (!day.from || !day.to) return "Program necompletat";
  return `${day.from} - ${day.to}`;
}

function formatWeeklyText(weekly) {
  const weekdayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const weekdayText = weekdayKeys.map((key) => formatDay(weekly[key]));
  const allSame = weekdayText.every((value) => value === weekdayText[0]);
  const weekdayLabel = allSame ? `Luni-Vineri: ${weekdayText[0]}` : weekdayKeys.map((key, i) => `${DAYS[i][1]}: ${weekdayText[i]}`).join("; ");
  return `${weekdayLabel}; Sambata: ${formatDay(weekly.saturday)}; Duminica: ${formatDay(weekly.sunday)}`;
}

function formatSaturdayText(weekly) {
  return formatDay(weekly.saturday);
}

function nextException(exceptions) {
  const today = new Date().toISOString().slice(0, 10);
  return [...exceptions].filter((item) => item.end_date >= today).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0] || null;
}

function ExceptionRow({ item, index, onChange, onRemove }) {
  const closed = item.type === "closed";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Tip</label>
          <select className={`${inputCls} mt-1`} value={item.type || "closed"} onChange={(e) => onChange(index, { ...item, type: e.target.value })}>
            <option value="closed">Inchis</option>
            <option value="custom">Program special</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">De la</label>
          <input type="date" className={`${inputCls} mt-1`} value={item.start_date || ""} onChange={(e) => onChange(index, { ...item, start_date: e.target.value })} />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Pana la</label>
          <input type="date" className={`${inputCls} mt-1`} value={item.end_date || ""} onChange={(e) => onChange(index, { ...item, end_date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">De la ora</label>
            <input type="time" disabled={closed} className={`${inputCls} mt-1 disabled:opacity-50`} value={item.from || ""} onChange={(e) => onChange(index, { ...item, from: e.target.value })} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Pana la</label>
            <input type="time" disabled={closed} className={`${inputCls} mt-1 disabled:opacity-50`} value={item.to || ""} onChange={(e) => onChange(index, { ...item, to: e.target.value })} />
          </div>
        </div>
        <button type="button" onClick={() => onRemove(index)} className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 hover:bg-secondary">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3">
        <label className="text-[11px] font-semibold text-muted-foreground">Mesaj public, optional</label>
        <input className={`${inputCls} mt-1`} value={item.public_note || ""} onChange={(e) => onChange(index, { ...item, public_note: e.target.value })} placeholder="Ex: Inchis de sarbatori / Program special de inventar" />
      </div>
    </div>
  );
}

export default function ProviderHours({ locationId, location = {}, onRefresh }) {
  const [state, setState] = useState(() => initialState(location));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const upcoming = useMemo(() => nextException(state.exceptions), [state.exceptions]);
  const weeklyText = useMemo(() => formatWeeklyText(state.weekly), [state.weekly]);

  const updateDay = (key, patch) => {
    setState((cur) => ({ ...cur, weekly: { ...cur.weekly, [key]: { ...cur.weekly[key], ...patch } } }));
  };

  const applyPreset = (preset) => {
    if (preset === "standard") {
      setState((cur) => ({ ...cur, weekly: normalizeWeekly(DEFAULT_WEEKLY) }));
    }
    if (preset === "copy_monday") {
      setState((cur) => {
        const monday = cur.weekly.monday;
        return { ...cur, weekly: Object.fromEntries(DAYS.map(([key]) => [key, key === "sunday" ? cur.weekly.sunday : { ...monday }])) };
      });
    }
    if (preset === "weekend_closed") {
      setState((cur) => ({ ...cur, weekly: { ...cur.weekly, saturday: { open: false, from: "", to: "" }, sunday: { open: false, from: "", to: "" } } }));
    }
  };

  const addException = () => {
    setState((cur) => ({
      ...cur,
      exceptions: [...cur.exceptions, { type: "closed", start_date: "", end_date: "", from: "", to: "", public_note: "" }],
    }));
  };

  const updateException = (index, value) => {
    setState((cur) => ({ ...cur, exceptions: cur.exceptions.map((item, i) => (i === index ? value : item)) }));
  };

  const removeException = (index) => {
    setState((cur) => ({ ...cur, exceptions: cur.exceptions.filter((_item, i) => i !== index) }));
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const opening_hours_json = JSON.stringify({ weekly: state.weekly, exceptions: state.exceptions });
    const payload = {
      location_id: locationId,
      opening_hours_json,
      opening_hours: weeklyText,
      saturday_hours: formatSaturdayText(state.weekly),
      availability_status: state.availability_status,
      availability_updated_at: new Date().toISOString(),
    };
    const res = await base44.functions.invoke("saveProviderRoutineProfile", payload).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Programul a fost salvat. Programul special se aplica doar pe intervalul setat, apoi revine la programul normal.");
    onRefresh && onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Program de lucru</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Seteaza programul normal al locatiei si eventualele exceptii pentru sarbatori, inventar, concediu sau evenimente temporare.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
          Se publica imediat
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Program saptamanal</h2>
            <p className="mt-1 text-xs text-muted-foreground">Completeaza intervalul de lucru pentru fiecare zi.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset("standard")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">L-V 09-18, S 09-14</button>
            <button type="button" onClick={() => applyPreset("copy_monday")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Copiaza luni</button>
            <button type="button" onClick={() => applyPreset("weekend_closed")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Weekend inchis</button>
          </div>
        </div>

        <div className="space-y-2">
          {DAYS.map(([key, label]) => {
            const day = state.weekly[key];
            return (
              <div key={key} className="grid gap-2 rounded-2xl border border-border bg-secondary/30 p-3 md:grid-cols-[120px_120px_1fr_1fr] md:items-center">
                <div className="text-sm font-bold">{label}</div>
                <select className={inputCls} value={day.open ? "open" : "closed"} onChange={(e) => updateDay(key, e.target.value === "open" ? { open: true, from: day.from || "09:00", to: day.to || "18:00" } : { open: false, from: "", to: "" })}>
                  <option value="open">Deschis</option>
                  <option value="closed">Inchis</option>
                </select>
                <input type="time" disabled={!day.open} className={`${inputCls} disabled:opacity-50`} value={day.from || ""} onChange={(e) => updateDay(key, { from: e.target.value })} />
                <input type="time" disabled={!day.open} className={`${inputCls} disabled:opacity-50`} value={day.to || ""} onChange={(e) => updateDay(key, { to: e.target.value })} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Program special</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Adauga perioade temporare pentru sarbatori, concedii, inventar sau evenimente. Dupa data de final, profilul revine automat la programul saptamanal.
            </p>
          </div>
          <button type="button" onClick={addException} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
            <Plus className="h-3.5 w-3.5" /> Adauga exceptie
          </button>
        </div>

        <div className="space-y-3">
          {state.exceptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-5 text-center text-xs text-muted-foreground">
              Nu exista program special setat.
            </div>
          ) : state.exceptions.map((item, index) => (
            <ExceptionRow key={index} item={item} index={index} onChange={updateException} onRemove={removeException} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <h2 className="text-sm font-bold">Preview public</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-secondary/45 px-4 py-3">
            <div className="text-[11px] font-semibold text-muted-foreground">Program afisat</div>
            <p className="mt-1 text-sm font-semibold leading-relaxed">{weeklyText}</p>
          </div>
          <div className="rounded-2xl bg-secondary/45 px-4 py-3">
            <div className="text-[11px] font-semibold text-muted-foreground">Urmatoarea exceptie</div>
            <p className="mt-1 text-sm font-semibold leading-relaxed">
              {upcoming ? `${upcoming.start_date} - ${upcoming.end_date}: ${upcoming.type === "closed" ? "Inchis" : `${upcoming.from || "--:--"} - ${upcoming.to || "--:--"}`} ${upcoming.public_note ? `· ${upcoming.public_note}` : ""}` : "Nu exista exceptii viitoare"}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs font-semibold text-muted-foreground">Disponibilitate</label>
          <select className={`${inputCls} mt-1.5 max-w-md`} value={state.availability_status} onChange={(e) => setState({ ...state, availability_status: e.target.value })}>
            <option value="necunoscuta">Disponibilitate nepublicata</option>
            {Object.entries(AVAILABILITY_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-1 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
            <Save className="h-4 w-4" /> Salveaza programul
          </button>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
