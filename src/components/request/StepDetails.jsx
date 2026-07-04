import React from "react";
import { SERVICES, getCategory } from "@/lib/vezunde";
import PhotoUpload from "@/components/request/PhotoUpload";

const CHOICE = (active) =>
  `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-primary bg-accent text-primary" : "border-border bg-card hover:border-primary/40"
  }`;

export default function StepDetails({ data, update, onNext, onBack }) {
  const category = getCategory(data.category);
  const isRepair = data.category === "reparatii";

  const toggleService = (key) => {
    const services = data.services.includes(key)
      ? data.services.filter((s) => s !== key)
      : [...data.services, key];
    update({ services });
  };

  return (
    <div>
      <h2 className="font-heading text-2xl font-bold tracking-tight">Cateva detalii</h2>
      <div className="mt-6">
        <div className="text-sm font-medium">Pentru cine?</div>
        <div className="mt-2 flex gap-2.5">
          <button type="button" className={CHOICE(data.forWhom === "adult")} onClick={() => update({ forWhom: "adult" })}>Adult</button>
          <button type="button" className={CHOICE(data.forWhom === "copil")} onClick={() => update({ forWhom: "copil" })}>Copil</button>
        </div>
      </div>
      <div className="mt-6">
        <div className="text-sm font-medium">Cat de urgent?</div>
        <div className="mt-2 flex gap-2.5">
          <button type="button" className={CHOICE(data.urgency === "normala")} onClick={() => update({ urgency: "normala" })}>Nu e urgent</button>
          <button type="button" className={CHOICE(data.urgency === "urgenta")} onClick={() => update({ urgency: "urgenta" })}>Cat mai repede</button>
        </div>
      </div>
      {category && (
        <div className="mt-6">
          <div className="text-sm font-medium">Servicii relevante</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {category.services.map((key) => (
              <button key={key} type="button" className={CHOICE(data.services.includes(key))} onClick={() => toggleService(key)}>
                {SERVICES[key]}
              </button>
            ))}
          </div>
        </div>
      )}
      {isRepair && (
        <div className="mt-6">
          <div className="text-sm font-medium">Fotografii (optional, maxim 3)</div>
          <p className="mt-1 text-xs text-muted-foreground">Un specialist va evalua daca reparatia este posibila. Nu putem garanta reparatia.</p>
          <PhotoUpload photos={data.photos} onChange={(photos) => update({ photos })} />
        </div>
      )}
      <div className="mt-8 flex gap-3">
        <button onClick={onBack} className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary/40 transition-colors">Inapoi</button>
        <button onClick={onNext} className="bg-primary text-primary-foreground rounded-full px-8 py-3 font-medium hover:opacity-90 transition-opacity">Continua</button>
      </div>
    </div>
  );
}