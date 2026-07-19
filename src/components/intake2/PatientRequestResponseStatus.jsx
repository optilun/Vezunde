import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, HelpCircle, Loader2, Phone, RefreshCw, Store, UserCheck, UserX, XCircle } from "lucide-react";
import { getPatientRequestStatus, managePatientContactShareApproval } from "@/lib/patientRequestPersistenceClient";
import PatientRequestChat from "./PatientRequestChat";

const RESPONSE_PRESENTATION = {
  can_help: { icon: CheckCircle2, title: "Locația poate ajuta", description: "Locația a confirmat că poate analiza cererea ta." },
  needs_details: { icon: HelpCircle, title: "Sunt necesare informații suplimentare", description: "Locația are nevoie de câteva detalii înainte să confirme." },
  cannot_help: { icon: XCircle, title: "Locația nu poate ajuta momentan", description: "Poți continua să urmărești răspunsurile celorlalte locații." },
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function PatientRequestResponseStatus({ requestId, accessToken }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingLocationId, setUpdatingLocationId] = useState("");

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

  useEffect(() => { void load(); }, [load]);

  const updatePhoneShare = async (locationId, action) => {
    setUpdatingLocationId(locationId);
    setError("");
    try {
      await managePatientContactShareApproval({ requestId, locationId, action, explicitAccessToken: accessToken || "" });
      await load();
    } catch (updateError) {
      setError(updateError?.message || "Acordul pentru telefon nu a putut fi actualizat.");
    } finally {
      setUpdatingLocationId("");
    }
  };

  return (
    <section className="mt-5 border-t border-primary/15 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground">Răspunsurile locațiilor</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Locațiile Pro din Top 3 pot vedea numele, mesajul și emailul verificat. Tu controlezi separat telefonul și deschiderea chatului pentru fiecare locație.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || Boolean(updatingLocationId)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Verifică răspunsurile
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</p>}

      {loading ? (
        <div className="mt-4 flex min-h-24 items-center justify-center rounded-xl border border-border bg-background text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificăm răspunsurile...</div>
      ) : !status?.responses?.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-4 text-center"><Store className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-semibold text-foreground">Nicio locație nu a răspuns încă</p><p className="mt-1 text-xs text-muted-foreground">Poți reveni și apăsa „Verifică răspunsurile”.</p></div>
      ) : (
        <div className="mt-4 space-y-3">
          {status.responses.map((response) => {
            const presentation = RESPONSE_PRESENTATION[response.response_type] || RESPONSE_PRESENTATION.needs_details;
            const Icon = presentation.icon;
            const approved = response.contact_share_status === "approved";
            const updating = updatingLocationId === response.location_id;
            const canManagePhone = response.contact_share_allowed && status.contact_phone_available === true;
            return (
              <article key={response.location_id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">{response.location_name}</p>
                      {formatDate(response.submitted_at) && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" /> {formatDate(response.submitted_at)}</span>}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">{presentation.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{presentation.description}</p>

                    {canManagePhone && (
                      <div className={`mt-4 rounded-xl border p-3 ${approved ? "border-primary/20 bg-primary/5" : "border-border bg-secondary/35"}`}>
                        <div className="flex items-start gap-2">
                          {approved ? <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <UserX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground">{approved ? "Telefonul este aprobat" : "Telefonul este încă ascuns"}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              {approved
                                ? "Doar această locație poate vedea numărul tău de telefon. Îl poți retrage oricând."
                                : "Aprobarea oferă numai acestei locații acces la numărul de telefon. Chatul nu primește automat această informație."}
                            </p>
                            <button type="button" onClick={() => void updatePhoneShare(response.location_id, approved ? "revoke" : "approve")} disabled={updating} className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-bold disabled:opacity-60 sm:w-auto ${approved ? "border border-border bg-background text-foreground hover:bg-secondary" : "bg-foreground text-background hover:opacity-90"}`}>
                              {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                              {approved ? "Retrage accesul la telefon" : "Permite acestei locații accesul la telefon"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <PatientRequestChat
                      requestId={requestId}
                      accessToken={accessToken || ""}
                      locationId={response.location_id}
                      locationName={response.location_name}
                      responseType={response.response_type}
                    />

                    {response.profile_available && <a href={`/furnizor/${response.location_id}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">Vezi profilul public <ExternalLink className="h-3.5 w-3.5" /></a>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
