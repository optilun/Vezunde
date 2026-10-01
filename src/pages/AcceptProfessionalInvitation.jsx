import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, MapPin, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
// 2026-09-03: etichetele profesiilor vin din shared/professionalIdentity.js, prin catalogul de
// interfata. Erau rescrise si aici, si in inca noua locuri.
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";

// 2026-10-01. Pagina urmeaza acum acelasi drum ca invitatiile de membru (AcceptProviderInvitation):
// cu linkul din email arata intai locatia si rolul (`inspect`), iar fara link arata invitatiile
// active pe emailul contului (`list_mine`) - asa ajunge aici si /dupa-login. Acceptarea merge cu
// tokenul din link sau cu id-ul invitatiei, pe care backend-ul il accepta doar pentru emailul
// verificat al contului.

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(date);
}

function errorFrom(requestError, fallback) {
  const data = requestError?.response?.data || {};
  return { error: data.error || requestError?.message || fallback, invited_email_masked: data.invited_email_masked || "" };
}

function professionalLabel(type) {
  return PROFESSIONAL_TYPE_LABELS[type] || "Specialist";
}

export default function AcceptProfessionalInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [authState, setAuthState] = useState("loading");
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [invitedEmailMasked, setInvitedEmailMasked] = useState("");

  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated()
      .then((authenticated) => { if (active) setAuthState(authenticated ? "authenticated" : "anonymous"); })
      .catch(() => { if (active) setAuthState("anonymous"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated" || result) return undefined;
    let active = true;
    setLoadingInvitation(true);
    setError("");
    setInvitedEmailMasked("");
    const request = token
      ? base44.functions.invoke("professionalInvitationOps", { action: "inspect", token })
      : base44.functions.invoke("professionalInvitationOps", { action: "list_mine" });
    request
      .then((response) => {
        if (!active) return;
        const data = response.data || {};
        if (data.error) { setError(data.error); setInvitedEmailMasked(data.invited_email_masked || ""); return; }
        if (token) {
          if (data.already_accepted) { setResult({ already_accepted: true }); return; }
          setInvitation(data.invitation || null);
          setPendingInvitations([]);
        } else {
          const rows = data.invitations || [];
          setPendingInvitations(rows);
          setInvitation(rows.length === 1 ? rows[0] : null);
        }
      })
      .catch((requestError) => {
        if (!active) return;
        const failure = errorFrom(requestError, "Invitația nu a putut fi verificată.");
        setError(failure.error);
        setInvitedEmailMasked(failure.invited_email_masked);
      })
      .finally(() => { if (active) setLoadingInvitation(false); });
    return () => { active = false; };
  }, [authState, result, token]);

  const accept = async () => {
    if (!invitation) return;
    setAccepting(true);
    setError("");
    const response = await base44.functions.invoke("professionalInvitationOps", {
      action: "accept",
      ...(token ? { token } : { invitation_id: invitation.id }),
    }).catch((requestError) => ({ data: errorFrom(requestError, "Invitația nu a putut fi acceptată.") }));
    setAccepting(false);
    if (response.data?.error) {
      setError(response.data.error);
      setInvitedEmailMasked(response.data.invited_email_masked || "");
      return;
    }
    setResult(response.data);
    setPendingInvitations([]);
  };

  const login = () => base44.auth.redirectToLogin(window.location.href);
  const showChooser = authState === "authenticated" && !loadingInvitation && !token && pendingInvitations.length > 1 && !invitation && !result;
  const showEmpty = authState === "authenticated" && !loadingInvitation && !token && pendingInvitations.length === 0 && !result && !error;

  return (
    <div className="min-h-screen min-h-dvh bg-background px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] sm:pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="inline-flex items-center" aria-label="VIASEE - Pagina principală"><ViaseeBrand /></Link>
        <div className="mt-6 rounded-[28px] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <UserRoundCheck className="h-5 w-5" />
          </div>

          <h1 className="mt-5 font-heading text-2xl font-extrabold tracking-tight">Invitație de specialist VIASEE</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Acceptarea confirmă asocierea profesională cu locația. Nu primești acces administrativ la organizație, iar profilul nu devine public automat.
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/35 p-4 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>Profilul profesional rămâne în draft până când îl completezi și este verificat de VIASEE. Tu decizi apoi dacă apari public la această locație.</p>
            </div>
          </div>

          {authState === "loading" && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se verifică autentificarea...</div>
          )}

          {authState === "anonymous" && !result && (
            <div className="mt-6">
              <button type="button" onClick={login} className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background">Autentifică-te pentru a continua</button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Trebuie să folosești contul cu același email pe care a fost trimisă invitația.</p>
            </div>
          )}

          {authState === "authenticated" && loadingInvitation && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se verifică invitațiile asociate contului...</div>
          )}

          {showChooser && (
            <section className="mt-6 space-y-3">
              <div>
                <h2 className="text-sm font-bold">Alege invitația</h2>
                <p className="mt-1 text-xs text-muted-foreground">Ai mai multe invitații active pe adresa de email a contului.</p>
              </div>
              {pendingInvitations.map((item) => (
                <button key={item.id} type="button" onClick={() => setInvitation(item)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-secondary/20 p-4 text-left transition hover:bg-secondary/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card"><MapPin className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{item.location?.name || "Locație VIASEE"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{professionalLabel(item.professional_type)}{item.location?.city ? ` · ${item.location.city}` : ""}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </section>
          )}

          {showEmpty && (
            <div className="mt-6 rounded-2xl border border-border bg-secondary/20 p-4 text-sm leading-relaxed text-muted-foreground">
              Nu există invitații de specialist active pe adresa acestui cont. Dacă ai primit o invitație pe alt email, deschide linkul din acel email.
            </div>
          )}

          {authState === "authenticated" && invitation && !result && (
            <div className="mt-6 space-y-4">
              {!token && pendingInvitations.length > 1 && (
                <button type="button" onClick={() => setInvitation(null)} className="text-xs font-semibold underline underline-offset-4">Înapoi la toate invitațiile</button>
              )}
              <section className="rounded-2xl border border-border bg-secondary/25 p-4 sm:p-5">
                <p className="text-xs text-muted-foreground">Locația care te invită</p>
                <h2 className="mt-0.5 font-heading text-base font-bold">{invitation.location?.name || "Locație VIASEE"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{[invitation.location?.city, invitation.location?.county].filter(Boolean).join(", ")}</p>
                <div className="mt-3 inline-flex rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">{professionalLabel(invitation.professional_type)}</div>
                {formatDate(invitation.expires_at) && <p className="mt-3 text-[11px] text-muted-foreground">Invitația este valabilă până la {formatDate(invitation.expires_at)}.</p>}
              </section>
              <button type="button" disabled={accepting} onClick={accept} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">
                {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                {accepting ? "Se acceptă..." : "Acceptă asocierea profesională"}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" aria-live="polite" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
              {error}
              {invitedEmailMasked && (
                <p className="mt-1 text-xs">Invitația a fost trimisă la {invitedEmailMasked}. Autentifică-te cu contul care folosește această adresă.</p>
              )}
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-800" />
                <div>
                  <h2 className="text-sm font-bold text-green-950">{result.already_accepted ? "Invitația este deja acceptată" : "Asocierea a fost confirmată"}</h2>
                  {!result.already_accepted && (
                    <p className="mt-1 text-xs leading-relaxed text-green-900">
                      {result.location?.name || "Locația"} · {professionalLabel(result.professional?.professional_type)}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-green-900/80">Asocierea este privată. Următorul pas este completarea profilului profesional.</p>
                </div>
              </div>
              <Link to="/contul-meu?mode=professional" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-green-950 px-4 py-2 text-xs font-semibold text-white lg:min-h-0">Deschide contul profesional</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
