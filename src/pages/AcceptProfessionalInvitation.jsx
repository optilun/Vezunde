import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const PROFESSIONAL_TYPE_LABELS = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

export default function AcceptProfessionalInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [authState, setAuthState] = useState("loading");
  const [accepting, setAccepting] = useState(false);
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

  const accept = async () => {
    if (!token) {
      setError("Linkul invitației nu conține un token valid.");
      return;
    }

    setAccepting(true);
    setError("");
    const response = await base44.functions.invoke("professionalInvitationOps", {
      action: "accept",
      token,
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setAccepting(false);

    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setResult(response.data);
  };

  const login = () => base44.auth.redirectToLogin(window.location.href);

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm sm:p-8">
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
              <p>Profilul profesional va rămâne în draft până când îl completezi și este verificat de VIASEE.</p>
            </div>
          </div>

          {!token && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Linkul invitației este incomplet.</div>}

          {authState === "loading" && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se verifică autentificarea...</div>
          )}

          {authState === "anonymous" && !result && (
            <div className="mt-6">
              <button onClick={login} className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background">Autentifică-te pentru a continua</button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Trebuie să folosești contul cu același email pe care a fost trimisă invitația.</p>
            </div>
          )}

          {authState === "authenticated" && !result && (
            <div className="mt-6">
              <button disabled={accepting || !token} onClick={accept} className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">
                {accepting ? "Se acceptă..." : "Acceptă asocierea profesională"}
              </button>
            </div>
          )}

          {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">{error}</div>}

          {result && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-800" />
                <div>
                  <h2 className="text-sm font-bold text-green-950">Asocierea a fost confirmată</h2>
                  <p className="mt-1 text-xs leading-relaxed text-green-900">
                    {result.location?.name || "Locația"} · {PROFESSIONAL_TYPE_LABELS[result.professional?.professional_type] || "Specialist"}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-green-900/80">Asocierea este privată. Următorul pas este completarea profilului profesional.</p>
                </div>
              </div>
              <Link to="/contul-meu" className="mt-4 inline-flex rounded-full bg-green-950 px-4 py-2 text-xs font-semibold text-white">Deschide contul profesional</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
