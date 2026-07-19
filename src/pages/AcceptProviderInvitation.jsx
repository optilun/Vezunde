import React, { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

const ROLE_DETAILS = {
  organization_owner: {
    label: "Owner organizatie",
    description: "Vei putea administra organizatia si toate locatiile sale, inclusiv accesul utilizatorilor si setarile.",
  },
  location_manager: {
    label: "Manager locatie",
    description: "Vei putea gestiona continutul si operatiunile locatiilor mentionate in invitatie.",
  },
  location_staff: {
    label: "Membru locatie",
    description: "Vei avea acces operational limitat la locatiile mentionate in invitatie.",
  },
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AcceptProviderInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [authState, setAuthState] = useState("loading");
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated()
      .then((authenticated) => {
        if (active) setAuthState(authenticated ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (active) setAuthState("anonymous");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated" || result) return undefined;
    let active = true;
    setLoadingInvitation(true);
    setError("");

    const request = token
      ? base44.functions.invoke("acceptProviderMemberInvitation", { action: "inspect", token })
      : base44.functions.invoke("acceptProviderMemberInvitation", { action: "list_mine" });

    request
      .then((response) => {
        if (!active) return;
        if (response.data?.error) {
          setError(response.data.error);
          return;
        }
        if (token) {
          setInvitation(response.data?.invitation || null);
          setPendingInvitations([]);
          return;
        }
        const rows = response.data?.invitations || [];
        setPendingInvitations(rows);
        setInvitation(rows.length === 1 ? rows[0] : null);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || requestError.message || "Invitatia nu a putut fi verificata.");
      })
      .finally(() => {
        if (active) setLoadingInvitation(false);
      });
    return () => { active = false; };
  }, [authState, result, token]);

  const accept = async () => {
    if (!invitation) return;
    setAccepting(true);
    setError("");
    const response = await base44.functions.invoke("acceptProviderMemberInvitation", {
      action: "accept",
      ...(token ? { token } : { invitation_id: invitation.id }),
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message || "Invitatia nu a putut fi acceptata." },
    }));
    setAccepting(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setResult(response.data);
    setPendingInvitations([]);
  };

  const login = () => base44.auth.redirectToLogin(window.location.href);
  const role = invitation ? ROLE_DETAILS[invitation.proposed_role] : null;

  return (
    <div className="min-h-screen min-h-dvh bg-[#F8F7F3] px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] sm:pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center" aria-label="VIASEE - Pagina principala">
          <ViaseeBrand />
        </Link>

        <div className="mt-6 rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <UsersRound className="h-5 w-5" />
          </div>

          <h1 className="mt-5 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Invitatie de acces in VIASEE</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Invitatiile sunt asociate adresei tale de email. Dupa autentificare poti verifica organizatia, rolul si locatiile inainte sa accepti accesul.
          </p>

          {authState === "loading" && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Se verifica autentificarea...
            </div>
          )}

          {authState === "anonymous" && !result && (
            <div className="mt-6 rounded-2xl border border-border bg-secondary/30 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold">Autentificare necesara</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Foloseste contul VIASEE cu aceeasi adresa de email la care ai primit invitatia Base44.
                  </p>
                </div>
              </div>
              <button type="button" onClick={login} className="mt-4 w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background">
                Autentifica-te pentru a continua
              </button>
            </div>
          )}

          {authState === "authenticated" && loadingInvitation && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Se verifica invitatiile asociate contului...
            </div>
          )}

          {authState === "authenticated" && !loadingInvitation && !token && pendingInvitations.length > 1 && !invitation && !result && (
            <section className="mt-6 space-y-3">
              <div>
                <h2 className="text-sm font-bold">Alege invitatia</h2>
                <p className="mt-1 text-xs text-muted-foreground">Ai mai multe invitatii active asociate acestei adrese de email.</p>
              </div>
              {pendingInvitations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setInvitation(item)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-secondary/20 p-4 text-left transition hover:bg-secondary/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{item.organization?.name || "Organizatie VIASEE"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ROLE_DETAILS[item.proposed_role]?.label || item.proposed_role} · {(item.locations || []).length} {(item.locations || []).length === 1 ? "locatie" : "locatii"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </section>
          )}

          {authState === "authenticated" && !loadingInvitation && !token && pendingInvitations.length === 0 && !result && !error && (
            <div className="mt-6 rounded-2xl border border-border bg-secondary/20 p-4 text-sm leading-relaxed text-muted-foreground">
              Nu exista invitatii active asociate adresei acestui cont.
            </div>
          )}

          {authState === "authenticated" && invitation && !result && (
            <div className="mt-6 space-y-4">
              {!token && pendingInvitations.length > 1 && (
                <button type="button" onClick={() => setInvitation(null)} className="text-xs font-semibold underline underline-offset-4">
                  Inapoi la toate invitatiile
                </button>
              )}

              <section className="rounded-2xl border border-border bg-secondary/25 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Organizatie</p>
                    <h2 className="mt-0.5 font-heading text-base font-bold">{invitation.organization?.name || "Organizatie VIASEE"}</h2>
                    <div className="mt-2 inline-flex rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">
                      {role?.label || invitation.proposed_role}
                    </div>
                  </div>
                </div>
                {role?.description && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{role.description}</p>}
              </section>

              <section className="rounded-2xl border border-border p-4 sm:p-5">
                <h2 className="text-sm font-bold">Locatii incluse</h2>
                <div className="mt-3 space-y-2.5">
                  {(invitation.locations || []).map((location) => (
                    <div key={location.id} className="flex items-start gap-3 rounded-xl bg-secondary/30 p-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{location.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[location.city, location.county, location.address].filter(Boolean).join(" · ") || "Adresa nu este afisata"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {formatDate(invitation.expires_at) && (
                  <p className="mt-3 text-[11px] text-muted-foreground">Invitatia este valabila pana la {formatDate(invitation.expires_at)}.</p>
                )}
              </section>

              <div className="rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
                Acceptarea creeaza sau reactiveaza numai accesul descris mai sus. Contul personal VIASEE nu este modificat si nu se creeaza automat un profil profesional.
              </div>

              <button type="button" disabled={accepting} onClick={accept} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">
                {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                {accepting ? "Se accepta invitatia..." : "Accepta accesul"}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" aria-live="polite" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-800" />
                <div>
                  <h2 className="text-sm font-bold text-green-950">Accesul a fost confirmat</h2>
                  <p className="mt-1 text-xs leading-relaxed text-green-900">
                    Poti deschide acum workspace-ul {result.invitation?.organization?.name || "organizatiei"}.
                  </p>
                </div>
              </div>
              <Link to="/contul-meu?mode=provider" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-green-950 px-4 py-2 text-xs font-semibold text-white">
                Deschide workspace-ul organizatiei
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}