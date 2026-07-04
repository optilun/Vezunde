import React from "react";
import { ArrowLeft, BadgeCheck, MapPin } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function SimilarLocationCard({ location, onClaim, onContinue, onBack }) {
  return (
    <div className="text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Inapoi la cautare
      </button>
      <p className="mt-4 font-semibold text-sm">
        Am gasit o locatie similara in Vezunde. Verifica daca este locatia ta.
      </p>
      <div className="mt-3 rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
        <div className="font-semibold flex items-center gap-1.5">
          {location.name}
          {location.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}
        </div>
        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {location.city}{location.address ? `, ${location.address}` : ""}
        </div>
        <button
          type="button"
          onClick={onClaim}
          className="mt-3 px-4 py-2 rounded-full text-xs font-semibold text-white transition-colors"
          style={{ backgroundColor: "#171717" }}
        >
          Aceasta este locatia mea
        </button>
      </div>
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onContinue}
          className="px-6 py-3 rounded-full border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Nu este aceeasi locatie — adauga locatie noua
        </button>
      </div>
    </div>
  );
}