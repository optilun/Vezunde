import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-foreground/40 transition-colors";

export default function ClaimStepConfirm({ data, update, onNext }) {
  return (
    <div className="space-y-4">
      <input value={data.name} onChange={(e) => update({ name: e.target.value })} placeholder="Nume locatie" className={FIELD} />
      <input value={data.city} onChange={(e) => update({ city: e.target.value })} placeholder="Oras" className={FIELD} />
      <input value={data.address} onChange={(e) => update({ address: e.target.value })} placeholder="Adresa" className={FIELD} />
      <input value={data.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="Telefon public" className={FIELD} />
      <input value={data.website} onChange={(e) => update({ website: e.target.value })} placeholder="Website (optional)" className={FIELD} />
      <ContinueButton onClick={() => onNext()} disabled={!data.name.trim() || !data.city.trim()} />
    </div>
  );
}