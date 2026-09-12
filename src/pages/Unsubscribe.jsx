import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Pagina publica de dezabonare din emailurile de outreach VIASEE (marketing catre
// opticieni/clinici din director). Linkul din email (`buildUnsubscribeUrls` in
// base44/shared/outreachEmailPolicy.js) trimite aici cu `?t=<token semnat>`. Pagina insasi
// nu verifica nimic - doar apeleaza direct endpoint-ul functiei `directoryOps` cu
// `?outreach_action=unsubscribe`, care e verificat de router.ts INAINTE de autentificare
// (vezi outreachUnsubscribeOps.ts) - securitatea vine din semnatura tokenului, nu dintr-o
// sesiune VIASEE, asa ca aceasta pagina functioneaza si pentru un vizitator neautentificat.
export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") || "";
  const [state, setState] = useState("loading"); // loading | done | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setState("error");
        setErrorMessage("Linkul de dezabonare este incomplet. Lipseste tokenul.");
        return;
      }
      try {
        const response = await base44.functions.fetch(
          `/directoryOps?outreach_action=unsubscribe&t=${encodeURIComponent(token)}`,
          { method: "POST" },
        );
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || data?.error) {
          setState("error");
          setErrorMessage(data?.error || "Dezabonarea nu a putut fi confirmata.");
          return;
        }
        setState("done");
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setErrorMessage("A aparut o eroare de retea. Incearca din nou in cateva minute.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Se proceseaza dezabonarea...</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Un moment, confirmam cererea ta.
            </p>
          </>
        )}

        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Te-ai dezabonat cu succes</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Adresa ta a fost eliminata din lista de comunicari VIASEE pentru furnizori. Nu vei
              mai primi emailuri de acest tip.
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Nu am putut confirma dezabonarea</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Poti scrie oricand la{" "}
              <a href="mailto:contact@viasee.ro" className="underline underline-offset-2">
                contact@viasee.ro
              </a>{" "}
              pentru a fi eliminat manual din lista.
            </p>
          </>
        )}

        <Link
          to="/"
          className="mt-6 inline-block text-sm font-semibold text-foreground underline underline-offset-4"
        >
          Inapoi la VIASEE
        </Link>
      </div>
    </div>
  );
}
