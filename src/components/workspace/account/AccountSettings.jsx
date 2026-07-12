import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ExternalLink,
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

const MODE_LABELS = {
  personal: "Cont personal",
  provider: "Workspace furnizor",
  professional: "Cont profesional",
  applicant: "Pregatire profil",
};

function initials(value = "") {
  return String(value || "U")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
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

export default function AccountSettings({ user, accountModes = [], activeMode, onSwitchMode, onLogout }) {
  const [preferences, setPreferences] = useState(() => readAccountPreferences(user?.id));
  const [resetStatus, setResetStatus] = useState("idle");
  const [eligibility, setEligibility] = useState({ status: "loading", blockers: [], summary: null });

  useEffect(() => {
    setPreferences(readAccountPreferences(user?.id));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setEligibility({ status: "loading", blockers: [], summary: null });
    base44.functions.invoke("getMyAccountDeletionEligibility", {})
      .then((response) => {
        if (cancelled) return;
        setEligibility({
          status: "ready",
          blockers: response.data?.blockers || [],
          summary: response.data?.account_summary || null,
        });
      })
      .catch(() => {
        if (!cancelled) setEligibility({ status: "unavailable", blockers: [], summary: null });
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
    } catch (_error) {
      // Keep the response neutral. Password reset flows should not expose account state.
    } finally {
      setResetStatus("sent");
    }
  };

  const selectedStartMode = preferences.startMode === "last" || visibleModes.some((mode) => mode.key === preferences.startMode)
    ? preferences.startMode
    : "last";
  const fullName = user?.full_name || user?.name || "Utilizator VIASEE";
  const blockers = eligibility.blockers || [];
  const hasDeletionBlockers = blockers.length > 0;
  const deletionSubject = encodeURIComponent("Solicitare stergere cont VIASEE");
  const deletionBody = encodeURIComponent([
    "Buna ziua,",
    "",
    `Solicit stergerea contului VIASEE asociat adresei ${user?.email || "-"}.`,
    `Nume cont: ${fullName}`,
    `ID cont: ${user?.id || "-"}`,
    "",
    "Inteleg ca solicitarea va fi verificata si ca anumite date pot fi pastrate atunci cand exista o obligatie legala sau un blocaj operational.",
  ].join("\n"));
  const deletionHref = `mailto:contact@viasee.ro?subject=${deletionSubject}&body=${deletionBody}`;

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">Setarile contului</h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Aceste setari apartin contului tau VIASEE si se aplica indiferent daca folosesti zona personala, profesionala sau workspace-ul unui furnizor.
            </p>
          </div>
          <span className="w-fit rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">Setari globale</span>
        </div>
      </section>

      <SectionCard icon={UserRound} title="Contul tau" description="Identitatea contului este separata de profilul public al specialistului si de datele organizatiilor.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-sm font-bold text-background">
            {initials(fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold">{fullName}</div>
            <div className="mt-1 truncate text-sm text-muted-foreground">{user?.email || "Email indisponibil"}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {accountModes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => mode.key !== activeMode && onSwitchMode?.(mode.key)}
                  disabled={mode.key === activeMode || !onSwitchMode}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${mode.key === activeMode ? "bg-foreground text-background" : "border border-border bg-background hover:bg-secondary disabled:opacity-60"}`}
                >
                  {mode.label || MODE_LABELS[mode.key] || mode.key}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 rounded-2xl bg-secondary/35 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Numele si emailul sunt momentan afisate doar pentru verificare. Nu introducem schimbarea directa a emailului pana cand exista un flux sigur de reverificare.
        </p>
      </SectionCard>

      <SectionCard icon={Settings2} title="Preferinte aplicatie" description="Preferintele de baza sunt salvate pe acest dispozitiv si nu modifica organizatia sau locatiile publice.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="start-mode" className="text-xs font-semibold text-muted-foreground">La autentificare deschide</label>
            <select
              id="start-mode"
              value={selectedStartMode}
              onChange={(event) => savePreference({ startMode: event.target.value })}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/40"
            >
              <option value="last">Ultimul spatiu folosit</option>
              {visibleModes.map((mode) => <option key={mode.key} value={mode.key}>{mode.label || MODE_LABELS[mode.key] || mode.key}</option>)}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Daca spatiul ales nu mai este disponibil, VIASEE deschide automat urmatorul spatiu la care ai acces.</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4">
            <input
              type="checkbox"
              checked={preferences.rememberLastLocation}
              onChange={(event) => savePreference({ rememberLastLocation: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="block text-sm font-bold">Retine ultima locatie folosita</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Se aplica numai workspace-ului furnizor si numai pe acest dispozitiv.</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> Preferintele se salveaza automat.
        </div>
      </SectionCard>

      <SectionCard icon={LockKeyhole} title="Securitate" description="Base44 gestioneaza autentificarea si parolele. VIASEE foloseste numai fluxurile confirmate in infrastructura actuala.">
        <div className="divide-y divide-border/70">
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold">Resetarea parolei</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Pentru conturile care folosesc email si parola, vei primi un link de resetare pe adresa contului.</p>
              {resetStatus === "sent" && <p className="mt-2 text-xs font-semibold text-green-700">Daca resetarea este disponibila pentru acest cont, linkul a fost trimis.</p>}
            </div>
            <button
              type="button"
              onClick={requestPasswordReset}
              disabled={!user?.email || resetStatus === "sending"}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              {resetStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Trimite link de resetare
            </button>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold">Sesiunea curenta</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gestionarea sesiunilor multiple si autentificarea in doi pasi nu sunt expuse de infrastructura actuala.</p>
            </div>
            <button type="button" onClick={onLogout} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary">
              <LogOut className="h-4 w-4" /> Deconectare
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Confidentialitate si date" description="Documentele publice si solicitarile privind datele contului sunt separate de profilurile organizatiilor si specialistilor.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/confidentialitate" className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-secondary">
            Confidentialitate <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link to="/termeni" className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-secondary">
            Termeni si conditii <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <a href="mailto:contact@viasee.ro?subject=Solicitare%20privind%20datele%20contului%20VIASEE" className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-secondary">
            Contact pentru date <Mail className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </SectionCard>

      <SectionCard icon={TriangleAlert} title="Zona de pericol" description="Stergerea contului este o solicitare verificata, nu o actiune instantanee. Profilurile, accesul si obligatiile existente trebuie analizate inainte." danger>
        {eligibility.status === "loading" && (
          <div className="flex items-center gap-2 rounded-2xl bg-secondary/35 px-4 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificam daca exista blocaje operationale.
          </div>
        )}

        {hasDeletionBlockers && (
          <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-bold text-red-900">Contul nu poate fi sters momentan</div>
            {blockers.map((blocker, index) => (
              <p key={`${blocker.code || "blocker"}-${index}`} className="text-xs leading-relaxed text-red-900/80">{blocker.message}</p>
            ))}
            <p className="text-xs leading-relaxed text-red-900/80">Transfera mai intai rolul de owner unui alt utilizator activ, apoi reia solicitarea.</p>
          </div>
        )}

        {eligibility.status === "unavailable" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            Verificarea automata nu este disponibila momentan. Solicitarea poate fi trimisa suportului pentru verificare manuala.
          </div>
        )}

        {!hasDeletionBlockers && eligibility.status === "ready" && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-900">
            Nu am identificat un blocaj de tip ultim owner. Solicitarea va fi totusi verificata manual inainte de procesare.
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold">Solicita stergerea contului</div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Cererea este trimisa prin email catre VIASEE. Nicio data nu este stearsa automat la apasarea butonului.</p>
          </div>
          <a
            href={deletionHref}
            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold ${hasDeletionBlockers ? "border border-red-200 bg-white text-red-800 hover:bg-red-50" : "bg-red-700 text-white hover:bg-red-800"}`}
          >
            <Mail className="h-4 w-4" /> {hasDeletionBlockers ? "Contacteaza suportul" : "Trimite solicitarea"}
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
