import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { readAccountPreferences, saveAccountPreferences } from "@/lib/accountPreferences";
import PersonalProfileSettings from "./PersonalProfileSettings";

const MODE_LABELS = {
  personal: "Cont personal",
  provider: "Organizații",
  professional: "Cont profesional",
  applicant: "Pregătire profil",
};

export const LEAD_EMAIL_FOCUS_KEY = "viasee:account-settings-focus";

// 2026-10-09 (audit Setări, S5; Alex: „Fiecare își alege”): emailul la cereri noi, pe fiecare
// locație unde ești proprietar sau manager. Implicit pornit. Fără astfel de locații, secțiunea lipsește.
function LeadEmailPreferences() {
  const [state, setState] = useState({ status: "loading", items: [], error: "" });
  const [savingId, setSavingId] = useState("");
  const sectionRef = useRef(null);

  // 2026-10-09 (verificare live): „Setează notificările” din Setările organizației deschide
  // Setările contului direct la această secțiune, nu în capul paginii.
  useEffect(() => {
    if (state.status !== "ready" || state.items.length === 0) return;
    let focus = "";
    try {
      focus = window.sessionStorage.getItem(LEAD_EMAIL_FOCUS_KEY) || "";
      if (focus) window.sessionStorage.removeItem(LEAD_EMAIL_FOCUS_KEY);
    } catch (_error) {
      focus = "";
    }
    if (focus === "lead-email") sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.status, state.items.length]);

  useEffect(() => {
    let cancelled = false;
    base44.functions.invoke("myNotificationPreferencesOps", { action: "list" })
      .then((response) => { if (!cancelled) setState({ status: "ready", items: response.data?.items || [], error: "" }); })
      .catch(() => { if (!cancelled) setState({ status: "error", items: [], error: "Preferințele de notificare nu au putut fi încărcate." }); });
    return () => { cancelled = true; };
  }, []);

  const toggle = async (item, enabled) => {
    setSavingId(item.location_id);
    setState((current) => ({ ...current, error: "", items: current.items.map((row) => row.location_id === item.location_id ? { ...row, lead_email_enabled: enabled } : row) }));
    try {
      const response = await base44.functions.invoke("myNotificationPreferencesOps", { action: "set", location_id: item.location_id, lead_email_enabled: enabled });
      if (response.data?.error) throw new Error(response.data.error);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.response?.data?.error || error?.message || "Preferința nu a putut fi salvată. Încearcă din nou.",
        items: current.items.map((row) => row.location_id === item.location_id ? { ...row, lead_email_enabled: !enabled } : row),
      }));
    } finally {
      setSavingId("");
    }
  };

  if (state.status === "ready" && state.items.length === 0) return null;
  return (
    <div ref={sectionRef} id="notificari-email" className="scroll-mt-24">
    <SectionCard icon={BellRing} title="Notificări pe email" description="Alegi pentru tine, pe fiecare locație, dacă primești email la fiecare cerere nouă. Notificările din aplicație rămân active.">
      {state.status === "loading" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă locațiile…</p>}
      {state.items.length > 0 && (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
          {state.items.map((item) => (
            <li key={item.location_id} className="flex flex-col gap-3 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{item.location_name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{[item.city, item.role_label].filter(Boolean).join(" · ")}</span>
              </span>
              <label htmlFor={`lead-email-${item.location_id}`} className="flex shrink-0 cursor-pointer items-center gap-2.5 text-xs font-semibold">
                <input
                  id={`lead-email-${item.location_id}`}
                  type="checkbox"
                  checked={item.lead_email_enabled}
                  disabled={savingId === item.location_id}
                  onChange={(event) => void toggle(item, event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Email la fiecare cerere nouă
                {savingId === item.location_id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </label>
            </li>
          ))}
        </ul>
      )}
      {state.error && <p role="alert" className="mt-3 text-xs font-semibold text-red-800">{state.error}</p>}
    </SectionCard>
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, children, danger = false }) {
  return (
    <section className={`overflow-hidden rounded-[24px] border bg-card shadow-sm ${danger ? "border-red-200" : "border-border"}`}>
      <div className={`flex items-start gap-3 border-b px-5 py-4 ${danger ? "border-red-100 bg-red-50/70" : "border-border bg-card"}`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${danger ? "bg-red-100 text-red-800" : "bg-secondary"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function AccountSettings({ user, accountModes = [], activeMode, onSwitchMode, onLogout, onRefresh }) {
  const [preferences, setPreferences] = useState(() => readAccountPreferences(user?.id));
  const [resetStatus, setResetStatus] = useState("idle");
  const [eligibility, setEligibility] = useState({ status: "loading", blockers: [], summary: null, request: null });
  const [deletionConfirming, setDeletionConfirming] = useState(false);
  const [deletionSending, setDeletionSending] = useState(false);
  const [deletionError, setDeletionError] = useState("");

  useEffect(() => {
    setPreferences(readAccountPreferences(user?.id));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setEligibility({ status: "loading", blockers: [], summary: null, request: null });
    base44.functions.invoke("getMyAccountDeletionEligibility", {})
      .then((response) => {
        if (cancelled) return;
        setEligibility({
          status: "ready",
          blockers: response.data?.blockers || [],
          summary: response.data?.account_summary || null,
          request: response.data?.deletion_request || null,
        });
      })
      .catch(() => {
        if (!cancelled) setEligibility({ status: "unavailable", blockers: [], summary: null, request: null });
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const visibleModes = useMemo(
    () => accountModes.filter((mode) => mode && mode.key && mode.key !== "applicant"),
    [accountModes],
  );

  const savePreference = (updates) => {
    setPreferences(saveAccountPreferences(user?.id, updates));
  };

  const requestPasswordReset = async () => {
    if (!user?.email || resetStatus === "sending") return;
    setResetStatus("sending");
    try {
      await base44.auth.resetPasswordRequest(user.email);
    } catch {
      // Keep the response neutral. Password reset flows should not expose account state.
    } finally {
      setResetStatus("sent");
    }
  };

  const selectedStartMode = preferences.startMode === "last" || visibleModes.some((mode) => mode.key === preferences.startMode)
    ? preferences.startMode
    : "last";
  const blockers = eligibility.blockers || [];
  const hasDeletionBlockers = blockers.length > 0;
  // 2026-10-01: cererea de stergere nu mai deschide un email (care se putea pierde). Se inregistreaza
  // in VIASEE si apare in Admin -> Suport, cu termen de raspuns de 30 de zile. Nimic nu se sterge
  // automat la apasarea butonului.
  const deletionRequest = eligibility.request;
  const formatDay = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(date)
      : "";
  };
  const sendDeletionRequest = async () => {
    setDeletionSending(true);
    setDeletionError("");
    const response = await base44.functions.invoke("getMyAccountDeletionEligibility", { action: "request" })
      .catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setDeletionSending(false);
    setDeletionConfirming(false);
    if (response.data?.error || !response.data?.deletion_request) {
      setDeletionError(response.data?.error || "Cererea nu a putut fi înregistrată. Încearcă din nou sau scrie la contact@viasee.ro.");
      return;
    }
    setEligibility({
      status: "ready",
      blockers: response.data.blockers || [],
      summary: response.data.account_summary || null,
      request: response.data.deletion_request,
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">Setările contului</h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Aceste setări aparțin contului tău VIASEE și se aplică în toate spațiile lui: personal, profesional și organizații.
            </p>
          </div>
          <span className="w-fit rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">Setări globale</span>
        </div>
      </section>

      <SectionCard icon={UserRound} title="Contul tău" description="Identitatea contului este separată de profilul public de specialist și de datele organizațiilor.">
        <PersonalProfileSettings user={user} onRefresh={onRefresh} />
        <div className="mt-5 border-t border-border pt-5">
          <div className="text-xs font-semibold text-muted-foreground">Spațiile aceluiași cont</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {accountModes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => mode.key !== activeMode && onSwitchMode?.(mode.key)}
                disabled={mode.key === activeMode || !onSwitchMode}
                className={`min-h-11 rounded-full px-3 py-1 text-[11px] font-semibold transition lg:min-h-0 ${mode.key === activeMode ? "bg-foreground text-background" : "border border-border bg-background hover:bg-secondary disabled:opacity-60"}`}
              >
                {mode.label || MODE_LABELS[mode.key] || mode.key}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-4 rounded-2xl bg-secondary/35 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Emailul nu se modifică aici. Funcția, descrierea profesională și specializările se gestionează din Cont profesional și devin publice numai după verificarea VIASEE.
        </p>
      </SectionCard>

      <SectionCard icon={Settings2} title="Preferințe aplicație" description="Preferințele sunt salvate pe acest dispozitiv și nu schimbă organizația sau locațiile publice.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="start-mode" className="text-xs font-semibold text-muted-foreground">La autentificare deschide</label>
            <select
              id="start-mode"
              value={selectedStartMode}
              onChange={(event) => savePreference({ startMode: event.target.value })}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/40"
            >
              <option value="last">Ultimul spațiu folosit</option>
              {visibleModes.map((mode) => <option key={mode.key} value={mode.key}>{mode.label || MODE_LABELS[mode.key] || mode.key}</option>)}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Dacă spațiul ales nu mai este disponibil, VIASEE deschide automat următorul spațiu la care ai acces.</p>
          </div>

          {/* 2026-10-09 (audit Setări, S4): bifa „Reține ultima locație folosită” dubla alegerea din
              Setările organizației și, debifată, trecea pe „locație fixă” fără o locație aleasă. Alegerea
              rămâne într-un singur loc; aici doar trimitem acolo. */}
          {accountModes.some((mode) => mode?.key === "provider") && (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-background p-4">
              <span>
                <span className="block text-sm font-bold">Locația deschisă în organizație</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Dacă organizația are mai multe locații, alegi din Setările organizației → General ce locație se deschide prima.</span>
              </span>
              {onSwitchMode && (
                <button type="button" onClick={() => onSwitchMode("provider")} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold hover:bg-secondary">
                  Setările organizației <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> Preferințele se salvează automat.
        </div>
      </SectionCard>

      <LeadEmailPreferences />

      <SectionCard icon={LockKeyhole} title="Securitate" description="Autentificarea și parolele sunt gestionate prin sistemul securizat de autentificare al VIASEE.">
        <div className="divide-y divide-border/70">
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold">Resetarea parolei</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Pentru conturile cu email și parolă, primești un link de resetare pe adresa contului.</p>
              {resetStatus === "sent" && <p className="mt-2 text-xs font-semibold text-green-700">Dacă resetarea este disponibilă pentru acest cont, linkul a fost trimis.</p>}
            </div>
            <button
              type="button"
              onClick={requestPasswordReset}
              disabled={!user?.email || resetStatus === "sending"}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50 lg:h-10"
            >
              {resetStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Trimite link de resetare
            </button>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold">Sesiunea curentă</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Deocamdată nu poți vedea alte sesiuni deschise, iar autentificarea în doi pași nu este disponibilă.</p>
            </div>
            <button type="button" onClick={onLogout} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary lg:h-10">
              <LogOut className="h-4 w-4" /> Deconectare
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Confidențialitate și date" description="Documentele publice și solicitările privind datele contului sunt separate de profilurile organizațiilor și specialiștilor.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/confidentialitate" className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-secondary">
            Confidențialitate <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link to="/termeni" className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-secondary">
            Termeni și condiții <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <a href="mailto:contact@viasee.ro?subject=Solicitare%20privind%20datele%20contului%20VIASEE" className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-secondary">
            Contact pentru date <Mail className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </SectionCard>

      <SectionCard icon={TriangleAlert} title="Zona de pericol" description="Ștergerea contului este o solicitare verificată, nu o acțiune instantanee. Profilurile, accesul și obligațiile existente sunt analizate înainte." danger>
        {eligibility.status === "loading" && (
          <div className="flex items-center gap-2 rounded-2xl bg-secondary/35 px-4 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificăm dacă ceva împiedică ștergerea contului.
          </div>
        )}

        {hasDeletionBlockers && (
          <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-bold text-red-900">Contul nu poate fi șters momentan</div>
            {blockers.map((blocker, index) => (
              <p key={`${blocker.code || "blocker"}-${index}`} className="text-xs leading-relaxed text-red-900/80">{blocker.message}</p>
            ))}
            {/* 2026-10-09 (audit Setări, S3): mesajul serverului spune deja ce trebuie transferat; aici doar oferim ajutorul. */}
            <p className="text-xs leading-relaxed text-red-900/80">Poți trimite cererea acum, iar echipa VIASEE te ajută cu transferul.</p>
          </div>
        )}

        {eligibility.status === "unavailable" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            Verificarea automată nu este disponibilă momentan. Dacă trimiterea cererii nu reușește, scrie-ne la contact@viasee.ro.
          </div>
        )}

        {!hasDeletionBlockers && eligibility.status === "ready" && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-900">
            Nu am găsit nimic care să împiedice ștergerea. Cererea este totuși verificată manual înainte de procesare.
          </div>
        )}

        {deletionRequest ? (
          <div role="status" className="mt-4 rounded-2xl border border-border bg-secondary/35 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <div>
                <div className="text-sm font-bold">Cererea de ștergere a fost înregistrată</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Trimisă pe {formatDay(deletionRequest.requested_at)}. Echipa VIASEE îți răspunde la {user?.email || "adresa contului"} până la {formatDay(deletionRequest.due_at)}
                  {hasDeletionBlockers ? " și te ajută să transferi mai întâi rolul de proprietar." : "."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold">Solicită ștergerea contului</div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Cererea ajunge direct la echipa VIASEE, care îți răspunde în cel mult 30 de zile. Nicio dată nu este ștearsă automat la apăsarea butonului.
              </p>
            </div>
            {!deletionConfirming && (
              <button
                type="button"
                disabled={eligibility.status === "loading"}
                onClick={() => setDeletionConfirming(true)}
                className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold disabled:opacity-50 lg:h-10 ${hasDeletionBlockers ? "border border-red-200 bg-white text-red-800 hover:bg-red-50" : "bg-red-700 text-white hover:bg-red-800"}`}
              >
                <TriangleAlert className="h-4 w-4" /> Trimite cererea
              </button>
            )}
          </div>
        )}

        {!deletionRequest && deletionConfirming && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-relaxed text-red-900">
            <p className="font-semibold">Trimiți cererea de ștergere a contului {user?.email || ""}?</p>
            <p className="mt-1">Contul rămâne activ până când echipa VIASEE procesează cererea. Unele date pot fi păstrate când există o obligație legală.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={deletionSending} onClick={sendDeletionRequest} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-red-700 px-4 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                {deletionSending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {deletionSending ? "Se trimite..." : "Da, trimite cererea"}
              </button>
              <button type="button" disabled={deletionSending} onClick={() => setDeletionConfirming(false)} className="inline-flex min-h-10 items-center justify-center rounded-full border border-red-200 bg-white px-4 text-xs font-semibold text-red-900">
                Renunță
              </button>
            </div>
          </div>
        )}

        {deletionError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-red-800">{deletionError}</p>
        )}
      </SectionCard>
    </div>
  );
}
