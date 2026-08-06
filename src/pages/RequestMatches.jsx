import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import MatchResults from "@/components/intake2/MatchResults";
import RouteSeo from "@/components/seo/RouteSeo";

// Pagina dedicata de rezultate. ConversationalCard din hero navigheaza aici cand
// fluxul de intrebari ajunge la faza "results", in loc sa afiseze rezultatele
// inghesuite in cardul din hero. MatchResults isi citeste draftul cererii direct
// din sessionStorage (readPatientRequestDraft), deci functioneaza independent
// chiar daca pagina se incarca separat de fluxul de intrebari.
export default function RequestMatches() {
  const location = useLocation();
  const navigate = useNavigate();
  const { results, meta } = location.state || {};

  if (!Array.isArray(results)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <RouteSeo title="Rezultate cerere | VIASEE" description="Rezultatele cautarii tale pe VIASEE." noindex />
        <h1 className="font-display text-2xl font-bold text-foreground">Nu am gasit rezultate de afisat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este posibil sa fi ajuns direct pe aceasta pagina, fara sa treci prin cautare.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Inapoi la cautare
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <RouteSeo title="Rezultate cerere | VIASEE" description="Rezultatele cautarii tale pe VIASEE." noindex />
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Inapoi
      </button>
      <div className="mt-4">
        <MatchResults results={results} meta={meta} />
      </div>
    </div>
  );
}
