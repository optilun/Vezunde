import React from "react";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50 transition-colors";

export default function ContactIdentityFields({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3 text-left">
      <input className={inputCls} placeholder="Nume complet *" value={value.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
      <input className={inputCls} placeholder="Rol in organizatie" value={value.role} onChange={(e) => set("role", e.target.value)} />
      <input className={inputCls} type="email" placeholder="Email de serviciu *" value={value.email} onChange={(e) => set("email", e.target.value)} />
      <input className={inputCls} placeholder="Telefon" value={value.phone} onChange={(e) => set("phone", e.target.value)} />
      <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer pt-1">
        <input
          type="checkbox"
          className="mt-0.5 w-4 h-4"
          checked={value.representation_confirmed}
          onChange={(e) => set("representation_confirmed", e.target.checked)}
        />
        <span>Confirm ca reprezint aceasta locatie si ca informatiile transmise sunt corecte.</span>
      </label>
    </div>
  );
}