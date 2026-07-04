import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

export default function WizContact({ data, update, next }) {
  const loc = data.location;
  const set = (k, v) => update({ location: { ...loc, [k]: v } });
  return (
    <div className="space-y-3 text-left">
      <input className={inputCls} placeholder="Oras *" value={loc.city} onChange={(e) => set("city", e.target.value)} />
      <input className={inputCls} placeholder="Judet (optional)" value={loc.county} onChange={(e) => set("county", e.target.value)} />
      <input className={inputCls} placeholder="Adresa" value={loc.address} onChange={(e) => set("address", e.target.value)} />
      <input className={inputCls} placeholder="Telefon public" value={loc.phone_public} onChange={(e) => set("phone_public", e.target.value)} />
      <input className={inputCls} placeholder="Email public (optional)" value={loc.public_email} onChange={(e) => set("public_email", e.target.value)} />
      <input className={inputCls} placeholder="Website (optional)" value={loc.website} onChange={(e) => set("website", e.target.value)} />
      <ContinueButton onClick={next} disabled={!loc.city.trim()} />
    </div>
  );
}