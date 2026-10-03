import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ClipboardList, MapPin, MessageSquareText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { INTENTS } from "@/lib/intentRegistry";
import { readPatientRequestResumeAccess } from "@/lib/patientRequestPersistenceClient";
import { readableErrorMessage } from "@/lib/transientRetry";

// 2026-10-03. „Cererile mele” = cererile trimise ca pacient (structura conturilor, pasul 1).
// Revendicarile de organizatii s-au mutat in grupul Organizatii → „Solicitări de organizație”.

const LIFECYCLE = {
  active: { label: "Activă", cls: "bg-green-100 text-green-800" },
  resolved: { label: "Rezolvată", cls: "bg-secondary text-foreground" },
  closed: { label: "Închisă", cls: "bg-secondary text-muted-foreground" },
  expired: { label: "Expirată", cls: "bg-secondary text-muted-foreground" },
};

export function patientRequestLifecycle(request, now = Date.now()) {
  const state = request?.lifecycle_state || "active";
  const expiresAt = Date.parse(String(request?.expires_at || ""));
  if (state === "active" && Number.isFinite(expiresAt) && expiresAt <= now) return LIFECYCLE.expired;
  return LIFECYCLE[state] || LIFECYCLE.active;
}

function requestTitle(request) {
  return INTENTS[request.intent]?.label || request.intent_label || "Cerere";
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("ro-RO") : "";
}

function PatientRequestRow({ request }) {
  const status = patientRequestLifecycle(request);
  const sentAt = formatDate(request.submitted_at || request.created_date);
  const place = request.location_scope === "national" ? "Toată țara" : (request.city || request.county || "");
  // Pagina cererii se deschide cu linkul securizat. Daca acest browser il are salvat, ducem
  // utilizatorul direct acolo; altfel spunem de unde il poate deschide.
  const canOpenHere = Boolean(request.public_reference && readPatientRequestResumeAccess(request.public_reference)?.access_token);
  return (
    <article className="rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ClipboardList className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="break-words text-sm font-bold">{requestTitle(request)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {sentAt && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Trimisă {sentAt}</span>}
              {place && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {place}</span>}
              <span className="inline-flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5" /> {request.response_count === 1 ? "1 răspuns" : `${request.response_count || 0} răspunsuri`}</span>
            </div>
            {request.public_reference && <div className="mt-1.5 text-[11px] text-muted-foreground">Referință {request.public_reference}</div>}
          </div>
        </div>
        <span className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>
      <div className="mt-4">
        {canOpenHere ? (
          <Link to={`/cerere?ref=${encodeURIComponent(request.public_reference)}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:w-auto">
            Deschide cererea <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <p className="rounded-xl border border-border bg-secondary/35 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Pe acest dispozitiv, deschide cererea din emailul primit după trimitere. Linkul securizat al cererii nu este salvat în acest browser.
          </p>
        )}
      </div>
    </article>
  );
}

export default function PersonalRequests() {
  const [state, setState] = useState({ loading: true, error: "", requests: [], truncated: false });

  useEffect(() => {
    let active = true;
    base44.functions.invoke("getMyPatientRequests", {})
      .then((response) => {
        if (!active) return;
        const data = response?.data || {};
        if (data.error) setState({ loading: false, error: readableErrorMessage(data.error, "Cererile nu au putut fi încărcate."), requests: [], truncated: false });
        else setState({ loading: false, error: "", requests: data.requests || [], truncated: data.truncated === true });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: readableErrorMessage(error?.response?.data?.error || error?.message, "Cererile nu au putut fi încărcate."), requests: [], truncated: false });
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ClipboardList className="h-4 w-4" /></div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Cererile mele</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Cererile trimise către optici, clinici și cabinete cât timp erai conectat cu acest cont.</p>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {state.loading && <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Se încarcă cererile...</div>}
        {!state.loading && state.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">{state.error}</div>}
        {!state.loading && !state.error && state.requests.length === 0 && (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nu ai trimis încă nicio cerere din acest cont.</p>
            <Link to="/cerere" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90">
              Trimite o cerere <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        {state.requests.map((request) => <PatientRequestRow key={request.id} request={request} />)}
        {state.truncated && <p className="px-1 text-xs text-muted-foreground">Sunt afișate ultimele 50 de cereri.</p>}
      </div>
    </div>
  );
}
