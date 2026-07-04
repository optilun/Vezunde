import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { INTAKE_CITIES } from "@/lib/intake";

const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-foreground/40 transition-colors";

export default function OnbPublicInfo({ data, update, onNext }) {
  return (
    <div className="space-y-4">
      <input value={data.name} onChange={(e) => update({ name: e.target.value })} placeholder="Numele locatiei" className={FIELD} />
      <div className="flex flex-wrap gap-2">
        {INTAKE_CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => update({ city })}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              data.city === city ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40"
            }`}
          >
            {city}
          </button>
        ))}
      </div>
      <input value={data.address} onChange={(e) => update({ address: e.target.value })} placeholder="Adresa" className={FIELD} />
      <input value={data.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="Telefon public" className={FIELD} />
      <input value={data.opening_hours} onChange={(e) => update({ opening_hours: e.target.value })} placeholder="Program (ex: L-V 9:00-18:00, S 10:00-14:00)" className={FIELD} />
      <textarea value={data.description} onChange={(e) => update({ description: e.target.value })} placeholder="Scurta descriere publica (optional)" rows={3} className={`${FIELD} resize-none`} />
      <ContinueButton onClick={() => onNext()} disabled={!data.name.trim() || !data.city} />
    </div>
  );
}