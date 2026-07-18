import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  EyeOff,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { readAccountPreferences, saveAccountPreferences } from "@/lib/accountPreferences";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";

function locationLabel(location) {
  return location?.public_display_name || location?.name || "Locație";
}

function locationOptionLabel(location) {
  return [locationLabel(location), location?.locality_name || location?.city].filter(Boolean).join(" · ");
}

function SettingsSection({ title, description = "", danger = false, children = null }) {
  return (
    <section className={`overflow-hidden rounded-[20px] border bg-card shadow-[0_14px_40px_rgba(23,23,23,0.035)] ${danger ? "border-red-200" : "border-foreground/10"}`}>
      <div className={`border-b px-5 py-5 ${danger ? "border-red-100 bg-red-50/40" : "border-border bg-[#f8f4ec]/45"}`}>
        <h2 className={`text-lg font-bold ${danger ? "text-red-900" : "text-foreground"}`}>{title}</h2>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y divide-border/80">{children}</div>
    </section>
  );
}

function SettingsRow({ title, description = "", action = null, children = null }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-base font-semibold text-foreground">{title}</div>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0 sm:pl-6">{action}</div>}
    </div>
  );
}

function CompactButton({ children, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border bg-background px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${danger ? "border-red-300 text-red-700 hover:bg-red-50" : "border-border text-foreground hover:bg-secondary"}`}
    >
      {children}
    </button>
  );
}

function organizationStatus(organization) {
  if (["suspendata", "suspended"].includes(organization?.status)) return { label: "Suspendată", className: "bg-red-100 text-red-800" };
  if (["inactiva", "inactive"].includes(organization?.status)) return { label: "Inactivă", className: "bg-secondary text-muted-foreground" };
  return { label: "Activă", className: "bg-green-100 text-green-800" };
}

function organizationVisibility(organization) {
  const visibility = String(organization?.public_visibility_status || "").toLowerCase();
  if (["public", "published", "publicata", "visible", "approved"].includes(visibility)) return { label: "Profil public", className: "bg-green-100 text-green-800" };
  if (["pending_review", "in_review", "in_verificare"].includes(visibility)) return { label: "În verificare", className: "bg-amber-100 text-amber-800" };
  if (["hidden", "private", "unpublished", "ascunsa", "archived"].includes(visibility)) return { label: "Profil ascuns", className: "bg-secondary text-muted-foreground" };
  return { label: "Profil în pregătire", className: "bg-secondary text-muted-foreground" };
}

function locationVisibility(location) {
  if (location?.active_status === "inactiva") return { label: "Închisă", className: "bg-red-100 text-red-800" };
  if (location?.public_visibility_status === "archived") return { label: "Ascunsă", className: "bg-secondary text-muted-foreground" };
  if (location?.profile_control_status === "suspended" || location?.status === "suspendata") return { label: "Suspendată", className: "bg-red-100 text-red-800" };
  const visibility = String(location?.public_visibility_status || "").toLowerCase();
  if (["public", "published", "publicata", "visible", "approved"].includes(visibility) || location?.status === "publicata") return { label: "Publică", className: "bg-green-100 text-green-800" };
  if (["pending_review", "in_review", "in_verificare"].includes(visibility)) return { label: "În verificare", className: "bg-amber-100 text-amber-800" };
  return { label: "Draft", className: "bg-secondary text-muted-foreground" };
}

const LIFECYCLE_ACTION_LABELS = {
  hide: "ascundere temporară",
  republish: "republicare",
  close: "închidere",
};

const LIFECYCLE_STATUS_LABELS = {
  pending_review: "În verificare",
  needs_more_info: "Necesită completări",
  approved: "Aprobată",
  rejected: "Respinsă",
  withdrawn: "Retrasă",
};

function ConfirmationModal({ action, location, isLastActiveLocation, submitting, error, onClose, onConfirm }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const isClose = action === "close";
  const isRepublish = action === "republish";
  const expectedText = locationLabel(location);
  const canConfirm = isClose ? confirmationText.trim() === expectedText : acknowledged;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const title = isClose ? "Solicită închiderea locației" : isRepublish ? "Solicită republicarea locației" : "Ascunde temporar locația";
  const confirmationCopy = isRepublish
    ? `Confirm că doresc republicarea locației ${expectedText}.`
    : `Confirm că doresc să ascund temporar locația ${expectedText}.`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="provider-settings-confirm-title">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="provider-settings-confirm-title" className="text-base font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Acțiunea se aplică locației {expectedText}.</p>
          </div>
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40" aria-label="Închide">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {isClose ? (
            <>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-900">
                Locația va fi retrasă din director și arhivată după verificare. Contul personal VIASEE și celelalte locații rămân active.
              </div>
              {isLastActiveLocation && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Aceasta este ultima locație activă a organizației. Aprobarea cererii poate închide prezența publică a organizației în VIASEE.</span>
                </div>
              )}
              <div>
                <label htmlFor="confirm-location-name" className="text-sm font-medium text-foreground">Scrie exact numele locației pentru confirmare</label>
                <input
                  id="confirm-location-name"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={expectedText}
                  autoComplete="off"
                  disabled={submitting}
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-foreground/40 disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-secondary/45 p-4 text-sm leading-relaxed text-muted-foreground">
                {isRepublish
                  ? "Locația va reveni în căutare și pe profilul public numai după aprobarea administratorului."
                  : "Locația nu va mai fi vizibilă public, dar rămâne în workspace și poate fi republicată ulterior. Datele nu sunt șterse."}
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
                <input type="checkbox" checked={acknowledged} disabled={submitting} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
                <span className="text-sm leading-relaxed text-foreground">{confirmationCopy}</span>
              </label>
            </>
          )}
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-secondary/20 px-5 py-4">
          <CompactButton disabled={submitting} onClick={onClose}>Renunță</CompactButton>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || submitting}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-xs font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Trimite solicitarea
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProviderSettings({ user, workspace, overview, selectedLocationId, onSelectLocation, onSwitchMode, onNavigate }) {
  const [preferences, setPreferences] = useState(() => readAccountPreferences(user?.id));
  const [pendingAction, setPendingAction] = useState(null);
  const [lifecycleSubmission, setLifecycleSubmission] = useState(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleMessage, setLifecycleMessage] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const locations = workspace?.locations || [];
  const roleByLocation = workspace?.member_summary?.current_user_role_by_location || {};
  const ownerLocations = useMemo(() => {
    const filtered = locations.filter((location) => roleByLocation[location.id] === "organization_owner");
    if (filtered.length > 0) return filtered;
    const selected = locations.find((location) => location.id === selectedLocationId);
    return overview?.current_user_role === "organization_owner" && selected ? [selected] : [];
  }, [locations, overview?.current_user_role, roleByLocation, selectedLocationId]);

  const selectedLocation = ownerLocations.find((location) => location.id === selectedLocationId) || ownerLocations[0] || overview?.location || null;
  const organization = overview?.organization || workspace?.organizations?.find((item) => item.id === selectedLocation?.organization_id) || workspace?.organizations?.[0] || null;
  const organizationName = organization?.public_display_name || organization?.name || selectedLocation?.organization_name || "Organizație";
  const organizationLocations = locations.filter((location) => selectedLocation?.organization_id ? location.organization_id === selectedLocation.organization_id : location.id === selectedLocation?.id);
  const activeOrganizationLocations = organizationLocations.filter((location) => location.active_status !== "inactiva" && location.status !== "suspendata" && location.profile_control_status !== "suspended");
  const isLastActiveLocation = activeOrganizationLocations.length === 1 && activeOrganizationLocations[0]?.id === selectedLocation?.id;
  const visibility = locationVisibility(selectedLocation);
  const orgStatus = organizationStatus(organization);
  const orgVisibility = organizationVisibility(organization);
  const controlLabel = PROFILE_CONTROL_LABELS[selectedLocation?.profile_control_status] || selectedLocation?.profile_control_status || "În director";
  const locationHidden = selectedLocation?.public_visibility_status === "archived" && selectedLocation?.active_status !== "inactiva";
  const locationClosed = selectedLocation?.active_status === "inactiva";
  const lifecycleActive = ["pending_review", "needs_more_info"].includes(lifecycleSubmission?.status);

  useEffect(() => {
    let mounted = true;
    if (!selectedLocation?.id) {
      setLifecycleSubmission(null);
      return undefined;
    }
    setLifecycleLoading(true);
    setLifecycleError("");
    base44.functions.invoke("providerLocationLifecycleOps", { action: "get", location_id: selectedLocation.id })
      .then((response) => {
        if (!mounted) return;
        if (response.data?.error) setLifecycleError(response.data.error);
        else setLifecycleSubmission(response.data?.submission || null);
      })
      .catch((error) => {
        if (mounted) setLifecycleError(error.response?.data?.error || error.message || "Nu am putut încărca solicitările locației.");
      })
      .finally(() => mounted && setLifecycleLoading(false));
    return () => { mounted = false; };
  }, [selectedLocation?.id]);

  const fixedLocationId = locations.some((location) => location.id === preferences.fixedProviderLocationId)
    ? preferences.fixedProviderLocationId
    : selectedLocation?.id || locations[0]?.id || "";

  const setProviderLocationMode = (mode) => {
    const next = saveAccountPreferences(user?.id, {
      providerLocationMode: mode,
      rememberLastLocation: mode === "last",
      fixedProviderLocationId: mode === "fixed" ? fixedLocationId : preferences.fixedProviderLocationId,
    });
    setPreferences(next);
  };

  const setFixedLocation = (locationId) => {
    setPreferences(saveAccountPreferences(user?.id, {
      providerLocationMode: "fixed",
      rememberLastLocation: false,
      fixedProviderLocationId: locationId,
    }));
  };

  const confirmLifecycleRequest = async () => {
    if (!pendingAction || !selectedLocation?.id) return;
    setLifecycleLoading(true);
    setLifecycleError("");
    setLifecycleMessage("");
    const response = await base44.functions.invoke("providerLocationLifecycleOps", {
      action: "submit",
      location_id: selectedLocation.id,
      request_action: pendingAction,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLifecycleLoading(false);
    if (response.data?.error) {
      setLifecycleError(response.data.error);
      return;
    }
    setLifecycleSubmission(response.data?.submission || lifecycleSubmission);
    setLifecycleMessage(response.data?.message || "Solicitarea a fost trimisă spre verificare.");
    setPendingAction(null);
  };

  const withdrawLifecycleRequest = async () => {
    if (!selectedLocation?.id || !lifecycleSubmission?.id) return;
    setLifecycleLoading(true);
    setLifecycleError("");
    const response = await base44.functions.invoke("providerLocationLifecycleOps", {
      action: "withdraw",
      location_id: selectedLocation.id,
      submission_id: lifecycleSubmission.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLifecycleLoading(false);
    if (response.data?.error) {
      setLifecycleError(response.data.error);
      return;
    }
    setLifecycleSubmission({ ...lifecycleSubmission, status: "withdrawn" });
    setLifecycleMessage("Solicitarea a fost retrasă.");
  };

  if (!selectedLocation || overview?.current_user_role !== "organization_owner") return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-foreground/15 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-[2rem] font-extrabold leading-tight tracking-[-0.035em]">Setări organizație</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Acces owner
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Administrează configurarea privată a organizației și acțiunile care necesită acces de owner.
          </p>
        </div>

        {ownerLocations.length > 1 ? (
          <div className="w-full sm:w-auto">
            <label htmlFor="settings-location" className="text-xs font-medium text-muted-foreground">Setări pentru</label>
            <div className="relative mt-1 min-w-[250px]">
              <select
                id="settings-location"
                value={selectedLocation.id}
                onChange={(event) => onSelectLocation?.(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 pr-9 text-sm font-medium outline-none transition focus:border-foreground/30"
              >
                {ownerLocations.map((location) => <option key={location.id} value={location.id}>{locationOptionLabel(location)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Locație administrată: <span className="font-semibold text-foreground">{locationLabel(selectedLocation)}</span>
          </div>
        )}
      </div>

      <SettingsSection title="Organizație">
        <SettingsRow
          title="Organizație"
          description="Identitatea și datele publice sunt administrate separat de aceste setări private."
          action={(
            <div className="flex items-center gap-3">
              <span className="max-w-[240px] truncate text-sm font-medium text-foreground">{organizationName}</span>
              <CompactButton onClick={() => onNavigate?.("profile")}>Profil public <ExternalLink className="h-3.5 w-3.5" /></CompactButton>
            </div>
          )}
        />
        <SettingsRow
          title="Status organizație"
          description="Starea operațională și vizibilitatea profilului organizației."
          action={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orgStatus.className}`}>{orgStatus.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orgVisibility.className}`}>{orgVisibility.label}</span>
            </div>
          )}
        />
        <SettingsRow
          title="Locații"
          description={`${activeOrganizationLocations.length} active din ${organizationLocations.length} locații asociate organizației.`}
          action={<CompactButton onClick={() => onNavigate?.("locations")}>Vezi locațiile <ExternalLink className="h-3.5 w-3.5" /></CompactButton>}
        />
        <SettingsRow
          title="Acces și utilizatori"
          description="Administrează ownerii, managerii și membrii care pot lucra în organizație."
          action={<CompactButton onClick={() => onNavigate?.("access")}>Gestionează accesul <ExternalLink className="h-3.5 w-3.5" /></CompactButton>}
        />
      </SettingsSection>

      <SettingsSection title="Locația selectată" description={`Informațiile de mai jos se referă la ${locationLabel(selectedLocation)}.`}>
        <SettingsRow
          title="Vizibilitate publică"
          description="Arată dacă locația poate fi găsită și deschisă public în VIASEE."
          action={<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${visibility.className}`}>{visibility.label}</span>}
        />
        <SettingsRow
          title="Controlul profilului"
          description="Arată nivelul de verificare și control acordat furnizorului."
          action={<span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">{controlLabel}</span>}
        />
      </SettingsSection>

      <SettingsSection title="Preferințe workspace" description="Preferințele sunt personale și sunt salvate numai pe acest dispozitiv.">
        <SettingsRow
          title="La deschiderea workspace-ului"
          description="Alege dacă VIASEE deschide ultima locație folosită sau o locație fixă."
          action={(
            <div className="relative min-w-[230px]">
              <select
                value={preferences.providerLocationMode}
                onChange={(event) => setProviderLocationMode(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm font-medium outline-none transition focus:border-foreground/30"
              >
                <option value="last">Ultima locație folosită</option>
                <option value="fixed">O locație fixă</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}
        />
        {preferences.providerLocationMode === "fixed" && (
          <SettingsRow
            title="Locație fixă"
            description="Această locație va fi deschisă prima dată când intri în workspace."
            action={(
              <div className="relative min-w-[230px]">
                <select
                  value={fixedLocationId}
                  onChange={(event) => setFixedLocation(event.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm font-medium outline-none transition focus:border-foreground/30"
                >
                  {locations.map((location) => <option key={location.id} value={location.id}>{locationOptionLabel(location)}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
          />
        )}
      </SettingsSection>

      <SettingsSection title="Cont și securitate" description="Datele personale, parola și confidențialitatea sunt administrate separat de organizație.">
        <SettingsRow
          title="Cont personal VIASEE"
          description={user?.email || "Cont autentificat"}
          action={<CompactButton onClick={() => onSwitchMode?.("personal")}>Setările contului <ExternalLink className="h-3.5 w-3.5" /></CompactButton>}
        />
      </SettingsSection>

      <SettingsSection title="Zona de pericol" description={`Acțiunile se aplică locației ${locationLabel(selectedLocation)}, nu contului personal VIASEE.`} danger>
        {(lifecycleLoading || lifecycleActive || lifecycleMessage || lifecycleError) && (
          <div className="px-5 py-4">
            {lifecycleLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se actualizează starea solicitării...</p>}
            {!lifecycleLoading && lifecycleActive && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="font-semibold">Solicitare de {LIFECYCLE_ACTION_LABELS[lifecycleSubmission.action] || "schimbare"}: {LIFECYCLE_STATUS_LABELS[lifecycleSubmission.status] || lifecycleSubmission.status}</div>
                {lifecycleSubmission.admin_note && <p className="mt-2 text-xs leading-relaxed">Mesaj administrator: {lifecycleSubmission.admin_note}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {lifecycleSubmission.status === "needs_more_info" && (
                    <CompactButton disabled={lifecycleLoading} onClick={() => setPendingAction(lifecycleSubmission.action)}>Retrimite solicitarea</CompactButton>
                  )}
                  <CompactButton disabled={lifecycleLoading} onClick={withdrawLifecycleRequest}>Retrage solicitarea</CompactButton>
                </div>
              </div>
            )}
            {!lifecycleLoading && lifecycleMessage && <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{lifecycleMessage}</p>}
            {!lifecycleLoading && lifecycleError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{lifecycleError}</p>}
          </div>
        )}

        {!locationHidden && !locationClosed && (
          <SettingsRow
            title="Ascunde temporar locația"
            description="Locația dispare din căutare și din profilul public, dar rămâne în workspace și poate fi republicată."
            action={<CompactButton danger disabled={lifecycleActive || lifecycleLoading} onClick={() => setPendingAction("hide")}><EyeOff className="h-3.5 w-3.5" /> Ascunde locația</CompactButton>}
          />
        )}

        {locationHidden && !locationClosed && (
          <SettingsRow
            title="Republică locația"
            description="Solicită revenirea locației în căutare și pe profilul public."
            action={<CompactButton disabled={lifecycleActive || lifecycleLoading} onClick={() => setPendingAction("republish")}><RotateCcw className="h-3.5 w-3.5" /> Solicită republicarea</CompactButton>}
          />
        )}

        {!locationClosed && (
          <SettingsRow
            title="Închide locația în VIASEE"
            description="Locația este retrasă din director și arhivată după verificare. Istoricul este păstrat."
            action={<CompactButton danger disabled={lifecycleActive || lifecycleLoading} onClick={() => setPendingAction("close")}><Archive className="h-3.5 w-3.5" /> Solicită închiderea</CompactButton>}
          >
            {isLastActiveLocation && (
              <p className="mt-2 flex max-w-2xl items-start gap-2 text-xs leading-relaxed text-amber-800">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Aceasta este ultima locație activă a organizației.
              </p>
            )}
          </SettingsRow>
        )}
      </SettingsSection>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Solicitările sunt salvate în VIASEE, apar în panoul administratorului și păstrează istoricul complet al deciziei.
      </p>

      {pendingAction && (
        <ConfirmationModal
          action={pendingAction}
          location={selectedLocation}
          isLastActiveLocation={isLastActiveLocation}
          submitting={lifecycleLoading}
          error={lifecycleError}
          onClose={() => {
            if (!lifecycleLoading) {
              setPendingAction(null);
              setLifecycleError("");
            }
          }}
          onConfirm={confirmLifecycleRequest}
        />
      )}
    </div>
  );
}
