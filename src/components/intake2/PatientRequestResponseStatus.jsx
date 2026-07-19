import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, HelpCircle, Loader2, RefreshCw, Store, XCircle } from "lucide-react";
import { getPatientRequestStatus } from "@/lib/patientRequestPersistenceClient";

const RESPONSE_PRESENTATION = {
  can_help: {
    icon: CheckCircle2,
    title: "Locația poate ajuta",
    description: "Locația a confirmat că poate analiza cererea ta.",
  },
  needs_details: {
    icon: HelpCircle,
    title: "Sunt necesare informații suplimentare",
    description: "Locația are nevoie de câteva detalii înainte să confirme.",
  },
  cannot_help: {
    icon: XCircle,
    title: "Locația nu poate ajuta momentan",
    description: "Poți continua să urmărești răspunsurile celorlalte locații.",
  },
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PatientRequestResponseStatus({ requestId, accessToken }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError("");
    try {
      setStatus(await getPatientRequestStatus(requestId, accessToken || ""));
    } catch (loadError) {
      setError(loadError?.message || "Răspunsurile nu au putut fi încărcate.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mt-5 border-t border-primary/15 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground">Răspunsurile locațiilor</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Aici apar răspunsurile structurate. Datele de contact și conversația rămân blocate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Verifică răspunsurile
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-4 flex min-h-24 items-center justify-center rounded-xl border border-border bg-background text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificăm răspunsurile...
        </div>
      ) : !status?.responses?.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-4 text-center">
          <Store className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold text-foreground">Nicio locație nu a răspuns încă</p>
          <p className="mt-1 text-xs text-muted-foreground">Poți reveni și apăsa „Verifică răspunsurile”.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {status.responses.map((response) => {
            const presentation = RESPONSE_PRESENTATION[response.response_type] || RESPONSE_PRESENTATION.needs_details;
            const Icon = presentation.icon;
            const content = (
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink--0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">{response.location_name}</p>
                    {formatDate(response.submitted_at) && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 className="h-3 w-3" /> {formatDate(response.submitted_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-foreground">{presentation.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{presentation.description}</p>
                </div>
              </div>
            );
            return response.profile_available ? (
              <a
                key={response.location_id}
                href={`/furnizor/${response.location_id}`}
                className="block rounded-xl border border-border bg-background p-4 transition-colors hover:bg-secondary/50"
              >
                {content}
              </a>
            ) : (
              <div key={response.location_id} className="rounded-xl border border-border bg-background p-4">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
