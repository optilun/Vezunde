import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PROVIDER_TYPE_LABELS } from "./outreachLabels";

// Filtre de segmentare partajate intre campanie si sincronizarea contactelor din director. Camp
// gol = fara filtru pe acea dimensiune (toate valorile). Cand primeste `options` (valorile reale
// din contacte: judete, tipuri), filtrele se aleg din liste; altfel raman text separat prin virgula.

function toList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Textul se editeaza liber (virgula, spatiu, o valoare pe jumatate scrisa) si se transforma in lista
// doar la iesirea din camp sau la Enter. Transformarea la fiecare tasta stergea virgula imediat ce
// era scrisa, deci nu se putea introduce a doua valoare.
function ListField({ label, hint, value, onChange, disabled, placeholder }) {
  const external = Array.isArray(value) ? value.join(", ") : "";
  const [text, setText] = useState(external);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(external);
  }, [external, editing]);
  const commit = () => {
    setEditing(false);
    const next = toList(text);
    const current = Array.isArray(value) ? value : [];
    if (next.join("\u0000") !== current.join("\u0000")) onChange(next);
    setText(next.join(", "));
  };
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <input
        type="text"
        disabled={disabled}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

// Lista lunga (judete): valorile alese ca etichete care se pot sterge + o lista pentru adaugare.
function PickField({ id, label, hint, value, options, labels = {}, onChange, disabled }) {
  const selected = Array.isArray(value) ? value : [];
  const remaining = options.filter((option) => !selected.includes(option));
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {selected.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
            {labels[item] || item}
            <button type="button" disabled={disabled} onClick={() => onChange(selected.filter((v) => v !== item))} aria-label={`Scoate ${labels[item] || item}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <select
          id={id}
          disabled={disabled || !remaining.length}
          value=""
          onChange={(event) => { if (event.target.value) onChange([...selected, event.target.value]); }}
          className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] disabled:opacity-60"
        >
          <option value="">{selected.length ? "Adauga..." : "Toate — alege pentru a restrange"}</option>
          {remaining.map((option) => (
            <option key={option} value={option}>{labels[option] || option}</option>
          ))}
        </select>
      </div>
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ToggleChips({ label, hint, value, options, onChange, disabled }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (item) => onChange(selected.includes(item) ? selected.filter((v) => v !== item) : [...selected, item]);
  return (
    <div>
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(option.value)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

const CONTROL_STATUS_OPTIONS = [
  { value: "directory", label: "Director (nerevendicat)" },
  { value: "claimed", label: "Revendicat" },
  { value: "verified", label: "Verificat" },
  { value: "suspended", label: "Suspendat" },
];

const EMAIL_SCOPE_OPTIONS = [
  { value: "location", label: "Adresa unei locatii" },
  { value: "organization", label: "Adresa de organizatie" },
];

// hideContactOnlyFilters: la sincronizarea din director, tag-urile si tipul adresei inca nu exista
// (se calculeaza chiar atunci), deci filtrele respective nu se afiseaza acolo.
export default function OutreachAudienceBuilder({ filters, onChange, disabled, hideContactOnlyFilters = false, options = null }) {
  const patch = (key, val) => onChange({ ...filters, [key]: val });
  const counties = options?.counties || [];
  const providerTypes = options?.providerTypes || [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {counties.length ? (
        <PickField
          id="outreach-filter-counties"
          label="Judete"
          hint="Niciunul ales = toate judetele"
          value={filters.target_counties}
          options={counties}
          onChange={(val) => patch("target_counties", val)}
          disabled={disabled}
        />
      ) : (
        <ListField
          label="Judete tinta"
          hint="Gol = toate judetele"
          value={filters.target_counties}
          onChange={(val) => patch("target_counties", val)}
          disabled={disabled}
          placeholder="Bucuresti, Cluj, Timis"
        />
      )}
      {providerTypes.length ? (
        <ToggleChips
          label="Tip furnizor"
          hint="Niciunul ales = toate tipurile"
          value={filters.target_provider_types}
          options={providerTypes.map((value) => ({ value, label: PROVIDER_TYPE_LABELS[value] || value }))}
          onChange={(val) => patch("target_provider_types", val)}
          disabled={disabled}
        />
      ) : (
        <ListField
          label="Tip furnizor tinta"
          hint="Gol = toate tipurile"
          value={filters.target_provider_types}
          onChange={(val) => patch("target_provider_types", val)}
          disabled={disabled}
          placeholder="optica_medicala, clinica_oftalmologica"
        />
      )}
      <ToggleChips
        label="Status profil"
        hint="Niciunul ales = toate statusurile"
        value={filters.target_profile_control_status}
        options={CONTROL_STATUS_OPTIONS}
        onChange={(val) => patch("target_profile_control_status", val)}
        disabled={disabled}
      />
      {!hideContactOnlyFilters && (
        <ToggleChips
          label="Tipul adresei"
          hint="Niciunul ales = ambele. Adresa de organizatie = aceeasi adresa pentru mai multe locatii (de obicei sediul unui lant)."
          value={filters.target_email_scope}
          options={EMAIL_SCOPE_OPTIONS}
          onChange={(val) => patch("target_email_scope", val)}
          disabled={disabled}
        />
      )}
      {!hideContactOnlyFilters && (
        <ListField
          label="Etichete contact (tags)"
          hint="Gol = toate. Ex.: retea:lant, tip:clinica, adresa:organizatie"
          value={filters.target_tags}
          onChange={(val) => patch("target_tags", val)}
          disabled={disabled}
          placeholder="retea:lant"
        />
      )}
    </div>
  );
}
