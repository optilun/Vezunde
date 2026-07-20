import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clipboard, KeyRound, Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import PatientRequestEmailVerification from "@/components/intake2/PatientRequestEmailVerification";
import RequestWorkspace from "@/components/intake2/RequestWorkspace";
import {
  authorizePatientRequestDistribution,
  buildPatientRequestResumeUrl,
  getPatientRequestStatusByReference,
  readPatientRequestResumeAccess,
  storePatientRequestAccess,
  storePatientRequestResumeAccess,
} from "@/lib/patientRequestPersistenceClient";

function tokenFromHash() {
  try {
    return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("access") || "";
  } catch (_error) {
    return "";
  }
}

function removeAccessHash() {
  if (typeof window === "undefined" || !window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

export default function PatientRequestResume({ publicReference }) {
  const [snapshot, setSnapshot] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [distributionConsent, setDistributionConsent] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const hashToken = tokenFromHash();
    const stored = readPatientRequestResumeAccess(publicReference);
    const token = hashToken || stored?.access_token || "";
    if (!token) {
      setAccessToken("");
      setSnapshot(null);
      setError("Linkul securizat al cererii nu este disponibil in acest browser.");
      setLoading(false);
      return;
    }

    if (hashToken) {
      storePatientRequestResumeAccess({ publicReference, accessToken: hashToken });
      removeAccessHash();
    }

    try {
      const data = await getPatientRequestStatusByReference(publicReference, token);
      const requestId = data?.request?.id || "";
      if (!requestId) throw new Error("Cererea nu a putut fi identificata.");
      storePatientRequestAccess(requestId, token, data.request.public_reference || publicReference);
      setAccessToken(token);
      setSnapshot(data);
    } catch (loadError) {
      setSnapshot(null);
      setError(loadError?.message || "Cererea nu a putut fi incarcata.");
    } finally {
      setLoading(false);
    }
  }, [publicReference]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestId = snapshot?.request?.id || "";
  const workspace = snapshot?.workspace || {};
  const resumeUrl = useMemo(
    () => buildPatientRequestResumeUrl(publicReference, accessToken),
    [accessToken, publicReference],
  );

  const distribute = async () => {
    if (!distributionConsent) {
      setError("Este necesar acordul pentru trimiterea cererii.");
      return;
    }
    setDistributing(true);
    setError("");
    try {
      await authorizePatientRequestDistribution(requestId, accessToken);
      await load();
    } catch (distributionError) {
      setError(distributionError?.message || "Cererea nu a putut fi trimisa.");
    } finally {
      setDistributing(false);
    }
  };

  const copyResumeLink = async () => {
    if (!resumeUrl) return;
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      setError("Linkul nu a putut fi copiat automat.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center rounded-[28px] border border-border bg-card text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Se incarca cererea...
      </div>
    );
  }

  if (!snapshot) {
    return (
      <section className="mx-auto max-w-xl rounded-[28px] border border-border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold text-foreground">Accesul la cerere nu este disponibil</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Deschide linkul securizat primit pe email sau revino din browserul in care ai trimis cererea. Referinta publica singura nu ofera acces.
        </p>
        {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</p>}
        <button type="button" onClick={() => void load()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background">
          <RefreshCw className="h-4 w-4" /> Reincearca
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-foreground">Link securizat pentru cererea {publicReference}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Linkul include cheia privata de acces. Nu il publica si nu il trimite unei persoane necunoscute.</p>
            </div>
          </div>
          <button type="button" onClick={() => void copyResumeLink()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
            {copied ? "Link copiat" : "Copiaza linkul"}
          </button>
        </div>
      </section>

      {snapshot.contact_email_masked && !snapshot.contact_email_verified && (
        <PatientRequestEmailVerification
          requestId={requestId}
          accessToken={accessToken}
          onVerified={() => void load()}
        />
      )}

      {!snapshot.distribution_authorized ? (
        <section className="rounded-[28px] border border-primary/20 bg-card p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <Send className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h1 className="font-heading text-xl font-extrabold text-foreground">Trimite cererea catre locatiile relevante</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Cererea este salvata, dar nu a fost distribuita. Toate locatiile eligibile primesc doar rezumatul permis, iar telefonul ramane ascuns pana la acordul tau separat pentru fiecare locatie.
              </p>
            </div>
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4">
            <input type="checkbox" checked={distributionConsent} onChange={(event) => setDistributionConsent(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
            <span className="text-xs leading-relaxed text-muted-foreground">
              Sunt de acord ca VIASEE sa distribuie rezumatul cererii locatiilor eligibile si sa permita locatiilor Pro din Top 3 accesul la numele meu, mesajul detaliat si emailul verificat. Numarul de telefon ramane ascuns.
            </span>
          </label>
          {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</p>}
          <button type="button" disabled={distributing} onClick={() => void distribute()} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {distributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {distributing ? "Pregatim cererea..." : "Trimite cererea"}
          </button>
        </section>
      ) : (
        <RequestWorkspace
          requestId={requestId}
          accessToken={accessToken}
          publicReference={publicReference}
          results={Array.isArray(workspace.results) ? workspace.results : []}
          meta={workspace.meta || null}
          requestDraft={workspace.request_draft || null}
          detailedMessage={workspace.detailed_message || ""}
        />
      )}
    </div>
  );
}
