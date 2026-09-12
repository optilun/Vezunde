import React from "react";

// Filtre de segmentare partajate intre crearea campaniei si sincronizarea contactelor din
// director. Camp gol = fara filtru pe acea dimensiune (toate valorile). Listele sunt text
// simplu separat prin virgula - VIASEE nu are inca un endpoint de sugestii pentru judete/tipuri,
// iar acest ecran e un instrument intern folosit doar de admin.

function toList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ListField({ label, hint, value, onChange, disabled, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <input
        type="text"
        disabled={disabled}
        value={Array.isArray(value) ? value.join(", ") : ""}
        onChange={(event) => onChange(toList(event.target.value))}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const CONTROL_STATUS_OPTIONS = [
  { value: "directory", label: "Director (nerevendicat)" },
  { value: "claimed", label: "Revendicat" },
  { value: "verified", label: "Verificat" },
  { value: "suspended", label: "Suspendat" },
];

export default function OutreachAudienceBuilder({ filters, onChange, disabled }) {
  const patch = (key, val) => onChange({ ...filters, [key]: val });
  const toggleStatus = (value) => {
    const current = Array.isArray(filters.target_profile_control_status) ? filters.target_profile_control_status : [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    patch("target_profile_control_status", next);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ListField
        label="Judete tinta"
        hint="Gol = toate judetele"
        value={filters.target_counties}
        onChange={(val) => patch("target_counties", val)}
        disabled={disabled}
        placeholder="Bucuresti, Cluj, Timis"
      />
      <ListField
        label="Tip furnizor tinta"
        hint="Gol = toate tipurile"
        value={filters.target_provider_types}
        onChange={(val) => patch("target_provider_types", val)}
        disabled={disabled}
        placeholder="optica, clinica_oftalmologica"
      />
      <ListField
        label="Etichete contact (tags)"
        hint="Gol = toate contactele materializate"
        value={filters.target_tags}
        onChange={(val) => patch("target_tags", val)}
        disabled={disabled}
        placeholder="partener, eveniment_2026"
      />
      <div>
        <span className="text-xs font-semibold text-foreground">Status profil tinta</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {CONTROL_STATUS_OPTIONS.map((option) => {
            const active = Array.isArray(filters.target_profile_control_status) && filters.target_profile_control_status.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => toggleStatus(option.value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <span className="mt-1 block text-[11px] text-muted-foreground">Gol = toate statusurile</span>
      </div>
    </div>
  );
}
