import React from "react";
import ResultScopeGroups from "./ResultScopeGroups";

// Sectiunile „extinse” ale recomandarilor (2026-09-30, mutate din MatchResults.jsx fara schimbari de
// continut): optiuni relevante (extended_confirmed), optiuni din director (extended_directory) si
// grupurile structurale (profiluri din director fara servicii declarate). Componenta nu decide ce se
// arata si nu ordoneaza: primeste listele deja impartite dupa `result_bucket`, in ordinea serverului.
// Parintele o randeaza doar cand sectiunea „mai multe optiuni” este deschisa.
//
// `groupProps` = ce are nevoie ResultScopeGroups (aria cautarii, selectia, hover, pinii de pe harta).
export default function RecommendationExtendedSections({ confirmed, directory, structuralGroups, groupProps }) {
  return (
    <>
      {confirmed.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mai multe opțiuni relevante</div>
          <div className="mt-3">
            <ResultScopeGroups items={confirmed} {...groupProps} />
          </div>
        </div>
      )}

      {directory.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Opțiuni din director</div>
          <div className="mt-3">
            <ResultScopeGroups items={directory} {...groupProps} />
          </div>
        </div>
      )}

      {structuralGroups.map((group, groupIndex) => (
        <div key={group.capability} className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              {group.label}
            </div>
            {groupIndex === 0 && (
              <a href="/adauga-sau-revendica" className="text-[11px] font-medium text-foreground underline underline-offset-2">
                Sunteți reprezentantul uneia dintre acestea?
              </a>
            )}
          </div>
          {group.note && (
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-foreground/80">{group.note}</p>
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {group.capability === "medical"
              ? "Servicii neconfirmate de furnizor — sunați înainte să mergeti."
              : "Servicii neconfirmate de furnizor — confirmați telefonic înainte de deplasare."}
          </p>
          <div className="mt-3">
            <ResultScopeGroups items={group.items} {...groupProps} />
          </div>
        </div>
      ))}
    </>
  );
}
