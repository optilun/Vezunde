import React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Building2, MapPin } from "lucide-react";
import ProfessionalThumb from "@/components/results/ProfessionalThumb";
import { professionalTypeLabel } from "../../../shared/professionalIdentity.js";

// Cardul de specialist pentru rasfoirea directorului (/cauta).
//
// 2026-09-03. Perechea lui DirectoryResultCard si supus aceleiasi reguli: fara scor, fara insigna
// de recomandare, fara stilizare de Top 3. Rasfoirea nu este o recomandare - pacientul se uita
// peste cine exista intr-o localitate, nu primeste un raspuns la o nevoie. A imprumuta aici
// vizualul de rezultat potrivit ar transforma o listare alfabetica intr-un clasament implicit.

export default function ProfessionalDirectoryCard({ professional }) {
  const locations = Array.isArray(professional.locations) ? professional.locations : [];
  const primaryLocation = locations[0] || null;
  const specializations = Array.isArray(professional.specialization_labels)
    ? professional.specialization_labels
    : [];

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <ProfessionalThumb professional={professional} size="sm" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {professional.professional_type_label || professionalTypeLabel(professional.professional_type)}
            </div>
            <h3 className="mt-0.5 font-display text-lg font-bold leading-tight tracking-tight text-foreground">
              {professional.display_name}
            </h3>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-primary">
          <BadgeCheck className="h-3.5 w-3.5" />
          Verificat
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {primaryLocation?.city && (
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{primaryLocation.city}</span>
        )}
        {primaryLocation?.organization_name && (
          <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{primaryLocation.organization_name}</span>
        )}
      </div>

      {specializations.length > 0 && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          {specializations.slice(0, 3).join(" · ")}
          {specializations.length > 3 ? ` · +${specializations.length - 3}` : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/specialist/${professional.id}`}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
        >
          Vezi profilul
        </Link>
        {primaryLocation && (
          <Link
            to={`/furnizor/${primaryLocation.id}`}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
          >
            Vezi locația
          </Link>
        )}
      </div>
    </article>
  );
}
