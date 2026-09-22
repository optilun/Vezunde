import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailX, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Pagina publica de dezabonare din emailurile de outreach VIASEE (marketing catre
// opticieni/clinici din director). Linkul din email (`buildUnsubscribeUrls` in
// base44/shared/outreachEmailPolicy.js) trimite aici cu `?t=<token semnat>`. Pagina apeleaza
// direct endpoint-ul functiei `directoryOps` cu `?outreach_action=unsubscribe`, verificat de
// router.ts INAINTE de autentificare (vezi outreachUnsubscribeOps.ts): securitatea vine din
// semnatura tokenului, deci pagina merge si pentru un vizitator neautentificat.
//
// Deschiderea paginii NU dezaboneaza: multe firme au scanere care deschid automat fiecare link
// dintr-un email primit. Pagina afla doar adresa si categoria (mode: 'inspect'), iar dezabonarea
// se face la click. Butonul "Dezabonare" afisat de Gmail/Outlook langa expeditor dezaboneaza direct
// (one-click, RFC 8058), fara pagina aceasta.
const SCOPE_TEXT = {
  marketing: "Nu mai primesti prezentari si invitatii de la VIASEE. Anunturile importante despre platforma (de exemplu schimbari de reguli) pot ajunge in continuare.",
  announcement: "Nu mai primesti anunturi despre platforma VIASEE.",
  all: "Nu mai primesti niciun email de campanie de la VIASEE.",
};

const SCOPE_ACTION = {
  marketing: "Dezaboneaza-ma de la prezentari",
  announcement: "Dezaboneaza-ma de la anunturi",
  all: "Dezaboneaza-ma",
};

const SCOPE_QUESTION = {
  marketing: "Nu mai vrei prezentari si invitatii de la VIASEE?",
  announcement: "Nu mai vrei anunturi despre platforma VIASEE?",
  all: "Nu mai vrei emailuri de campanie de la VIASEE?",
};

function endpointFor(token) {
  return `/directoryOps?outreach_action=unsubscribe&t=${encodeURIComponent(token)}`;
}

async function postUnsubscribe(token, body) {
  const response = await base44.functions.fetch(endpointFor(token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error || "Cererea nu a putut fi procesata.");
  return data;
}

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") || "";
  const [state, setState] = useState("loading"); // loading | confirm | done | error
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [offeredScope, setOfferedScope] = useState("all");
  const [scope, setScope] = useState("all");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function inspect() {
      if (!token) {
        setState("error");
        setErrorMessage("Linkul de dezabonare este incomplet. Lipseste tokenul.");
        return;
      }
      try {
        const data = await postUnsubscribe(token, { mode: "inspect" });
        if (cancelled) return;
        setEmail(data.email || "");
        setOfferedScope(SCOPE_TEXT[data.scope] ? data.scope : "all");
        setState("confirm");
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setErrorMessage(error?.message || "Linkul de dezabonare nu a putut fi verificat.");
      }
    }
    inspect();
    return () => { cancelled = true; };
  }, [token]);

  const unsubscribe = async (requestedScope) => {
    setBusy(requestedScope);
    try {
      const data = await postUnsubscribe(token, requestedScope === "all" ? { scope: "all" } : {});
      setScope(SCOPE_TEXT[data.scope] ? data.scope : requestedScope);
      setState("done");
    } catch (error) {
      setState("error");
      setErrorMessage(error?.message || "A aparut o eroare de retea. Incearca din nou in cateva minute.");
    }
    setBusy("");
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Se verifica linkul...</h1>
          </>
        )}

        {state === "confirm" && (
          <>
            <MailX className="mx-auto h-10 w-10 text-foreground" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-foreground">{SCOPE_QUESTION[offeredScope]}</h1>
            {email && (
              <p className="mt-2 text-sm text-muted-foreground">
                Adresa: <span className="font-semibold text-foreground">{email}</span>
              </p>
            )}
            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => unsubscribe(offeredScope)}
                disabled={!!busy}
                className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60 sm:w-auto"
              >
                {busy === offeredScope ? "Se proceseaza..." : SCOPE_ACTION[offeredScope]}
              </button>
              {offeredScope !== "all" && (
                <button
                  type="button"
                  onClick={() => unsubscribe("all")}
                  disabled={!!busy}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
                >
                  {busy === "all" ? "Se proceseaza..." : "Nu mai vreau niciun email de la VIASEE"}
                </button>
              )}
            </div>
          </>
        )}

        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Te-ai dezabonat cu succes</h1>
            <p className="mt-2 text-sm text-muted-foreground">{SCOPE_TEXT[scope]}</p>
            {scope !== "all" && (
              <button
                type="button"
                onClick={() => unsubscribe("all")}
                disabled={!!busy}
                className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
              >
                {busy === "all" ? "Se proceseaza..." : "Nu mai vreau niciun email de la VIASEE"}
              </button>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Daca ai cont de furnizor pe VIASEE, emailurile despre contul tau (de exemplu cererile de la pacienti) continua sa ajunga.
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
