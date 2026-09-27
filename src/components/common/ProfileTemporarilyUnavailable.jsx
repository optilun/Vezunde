import React from "react";
import { Link } from "react-router-dom";

// 2026-09-27. Afisat cand un profil public nu a putut fi incarcat din cauza unei erori
// trecatoare (limita de trafic, 5xx), dupa reincercari. Nu spune „nu a fost gasit”, pentru ca
// profilul exista, si pagina nu primeste `noindex` (vezi src/lib/transientRetry.js).
export default function ProfileTemporarilyUnavailable({ onRetry }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">Profilul nu s-a putut încărca acum</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Serverul este ocupat pentru câteva momente. Încearcă din nou peste câteva secunde.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Încearcă din nou
          </button>
        )}
        <Link
          to="/cauta"
          className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground"
        >
          Caută în director
        </Link>
      </div>
    </div>
  );
}
