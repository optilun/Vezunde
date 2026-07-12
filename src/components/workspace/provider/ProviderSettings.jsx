import React, { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ExternalLink, EyeOff, Mail, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { readAccountPreferences, saveAccountPreferences } from "@/lib/accountPreferences";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";

function locationLabel(location) {
  return location?.public_display_name || location?.name || "Locatie";
}

function locationOptionLabel(location) {
  return [locationLabel(location), location?.locality_name || location?.city].filter(Boolean).join(" · ");
}

function SettingsSection({ title, description, danger = false, children }) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-card ${danger ? "border-red-200" : "border-border"}`}>
      <div className={`border-b px-5 py-4 ${danger ? "border-red-100 bg-red-50/40" : "border-border"}`}>
        <h2 className={`text-sm font-semibold ${danger ? "text-red-900" : "text-foreground"}`}>{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y divide-border/80">{children}</div>
    </section>
  );
}

function SettingsRow({ title, description, action, children }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0 sm:pl-6">{action}</div>}
    </div>
  );
}

function CompactButton({ children, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold transition ${danger ? "border-red-300 text-red-700 hover:bg-red-50" : "border-border text-foreground hover:bg-secondary"}`}
    >
      {children}
    </button>
  );
}

function organizationStatus(organization) {
  if (["suspendata", "suspended"].includes(organization?.status)) return { label: "Suspendata", className: "bg-red-100 text-red-800" };
  if (["inactiva", "inactive"].includes(organization?.status)) return { label: "Inactiva", className: "bg-secondary text-muted-foreground" };
  return { label: "Activa", className: "bg-green-100 text-green-800" };
}

function organizationVisibility(organization) {
  const visibility = String(organization?.public_visibility_status || "").toLowerCase();
  if (["public", "published", "publicata", "visible"].includes(visibility)) return { label: "Profil public", className: "bg-green-100 text-green-800" };
  if (["pending_review", "in_review", "in_verificare"].includes(visibility)) return { label: "In verificare", className: "bg-amber-100 text-amber-800" };
  if (["hidden", "private", "unpublished", "ascunsa"].includes(visibility)) return { label: "Profil ascuns", className: "bg-secondary text-muted-foreground" };
  return { label: "Profil in pregatire", className: "bg-secondary text-muted-foreground" };
}

function locationVisibility(location) {
  if (location?.profile_control_status === "suspended" || location?.status === "suspendata") return { label: "Suspendata", className: "bg-red-100 text-red-800" };
  if (location?.active_status === "inactiva") return { label: "Inactiva", className: "bg-secondary text-muted-foreground" };
  const visibility = String(location?.public_visibility_status || "").toLowerCase();
  if (["public", "published", "publicata", "visible"].includes(visibility) || location?.status === "publicata") return { label: "Publica", className: "bg-green-100 text-green-800" };
  if (["hidden", "private", "unpublished", "ascunsa"].includes(visibility)) return { label: "Ascunsa", className: "bg-secondary text-muted-foreground" };
  if (["pending_review", "in_review", "in_verificare"].includes(visibility)) return { label: "In verificare", className: "bg-amber-100 text-amber-800" };
  return { label: "Draft", className: "bg-secondary text-muted-foreground" };
}

function ConfirmationModal({ action, location, isLastActiveLocation, onClose, onConfirm }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const isClose = action === "close";
  const expectedText = locationLabel(location);
  const canConfirm = isClose ? confirmationText.trim() === expectedText : acknowledged;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="provider-settings-confirm-title">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="provider-settings-confirm-title" className="text-base font-semibold">
              {isClose ? "Solicita inchiderea locatiei" : "Ascunde temporar locatia"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Actiunea se aplica locatiei {expectedText}.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Inchide">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {isClose ? (
            <>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-relaxed text-red-900">
                Locatia va fi retrasa din director si arhivata dupa verificare. Contul personal VIASEE si celelalte locatii raman active.
              </div>
              {isLastActiveLocation && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Aceasta este ultima locatie activa a organizatiei. Aprobarea cererii poate inchide prezenta publica a organizatiei in VIASEE.</span>
                </div>
              )}
              <div>
                <label htmlFor="confirm-location-name" className="text-xs font-medium text-foreground">Scrie exact numele locatiei pentru confirmare</label>
                <input
                  id="confirm-location-name"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={expectedText}
                  autoComplete="off"
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-foreground/40"
                />
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-secondary/45 p-4 text-xs leading-relaxed text-muted-foreground">
                Locatia nu va mai fi vizibila public, dar ramane in workspace si poate fi republicata ulterior. Datele nu sunt sterse.
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
                <span className="text-xs leading-relaxed text-foreground">Confirm ca doresc sa ascund temporar locatia {expectedText}.</span>
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-secondary/20 px-5 py-4">
          <CompactButton onClick={onClose}>Renunta</CompactButton>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-xs font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Mail className="h-3.5 w-3.5" /> Continua cu solicitarea
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProviderSettings({ user, workspace, overview, selectedLocationId, onSelectLocation, onSwitchMode, onNavigate }) {
  const [preferences, setPreferences] = useState(() => readAccountPreferences(user?.id));
  const [pendingAction, setPendingAction] = useState(null);
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
  const organizationName = organization?.public_display_name || organization?.name || selectedLocation?.organization_name || "Organizatie";
  const organizationLocations = locations.filter((location) => selectedLocation?.organization_id ? location.organization_id === selectedLocation.organization_id : location.id === selectedLocation?.id);
  const activeOrganizationLocations = organizationLocations.filter((location) => location.active_status !== "inactiva" && location.status !== "suspendata" && location.profile_control_status !== "suspended");
  const isLastActiveLocation = activeOrganizationLocations.length === 1 && activeOrganizationLocations[0]?.id === selectedLocation?.id;
  const visibility = locationVisibility(selectedLocation);
  const orgStatus = organizationStatus(organization);
  const orgVisibility = organizationVisibility(organization);
  const controlLabel = PROFILE_CONTROL_LABELS[selectedLocation?.profile_control_status] || selectedLocation?.profile_control_status || "In director";

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

  const requestHref = (action) => {
    const isClose = action === "close";
    const subject = encodeURIComponent(`${isClose ? "Solicitare inchidere locatie" : "Solicitare ascundere locatie"} VIASEE - ${locationLabel(selectedLocation)}`);
    const body = encodeURIComponent([
      "Buna ziua,",
      "",
      `${isClose ? "Solicit inchiderea" : "Solicit ascunderea temporara"} locatiei "${locationLabel(selectedLocation)}" in VIASEE.`,
      `ID locatie: ${selectedLocation?.id || "-"}`,
      `Organizatie: ${organizationName}`,
      `Cont solicitant: ${user?.email || "-"}`,
      "",
      isClose
        ? "Inteleg ca locatia va fi retrasa din director si arhivata dupa verificare, fara stergerea contului personal VIASEE."
        : "Doresc ca locatia sa ramana in workspace, dar sa nu mai fie vizibila public pana la republicare.",
    ].join("\n"));
    return `mailto:contact@viasee.ro?subject=${subject}&body=${body}`;
  };

  const confirmLifecycleRequest = () => {
    if (!pendingAction || typeof window === "undefined") return;
    const href = requestHref(pendingAction);
    setPendingAction(null);
    window.location.assign(href);
  };

  if (!selectedLocation || overview?.current_user_role !== "organization_owner") return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">Setari organizatie</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Acces owner
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Administreaza configurarea privata a organizatiei si actiunile care necesita acces de owner.
          </p>
        </div>

        {ownerLocations.length > 1 ? (
          <div className="w-full sm:w-auto">
            <label htmlFor="settings-location" className="text-[11px] font-medium text-muted-foreground">Setari pentru</label>
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
            Locatie administrata: <span className="font-semibold text-foreground">{locationLabel(selectedLocation)}</span>
          </div>
        )}
      </div>

      <SettingsSection title="Organizatie">
        <SettingsRow
          title="Organizatie"
          description="Identitatea si datele publice sunt administrate separat de aceste setari private."
          action={(
            <div className="flex items-center gap-3">
              <span className="max-w-[240px] truncate text-sm font-medium text-foreground">{organizationName}</span>
              <CompactButton onClick={() => onNavigate?.("profile")}>Profil public <ExternalLink className="h-3.5 w-3.5" /></CompactButton>
            </div>
          )}
        />
        <SettingsRow
          title="Status organizatie"
          description="Starea operationala si vizibilitatea profilului organizatiei."
          action={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${orgStatus.className}`}>{orgStatus.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${orgVisibility.className}`}>{orgVisibility.label}</span>
            </div>
          )}
        />
        <SettingsRow
          title="Locatii"
          description={`${activeOrganizationLocations.length} active din ${organizationLocations.length} locatii asociate organizatiei.`}
          action={<CompactButton onClick={() => onNavigate?.("locations")}>Vezi locatiile <ExternalLink className="h-3.5 w-3.5" /></CompactButton>}
        />
        <SettingsRow
          title="Acces si utilizatori"
          description="Administreaza ownerii, managerii si membrii care pot lucra in organizatie."
          action={<CompactButton onClick={() => onNavigate?.("access")}>Gestioneaza accesul <ExternalLink className="h-3.5 w-3.5" /></CompactButton>}
        />
      </SettingsSection>

      <SettingsSection title="Locatia selectata" description={`Informatiile de mai jos se refera la ${locationLabel(selectedLocation)}.`}>
        <SettingsRow
          title="Vizibilitate publica"
          description="Arata daca locatia poate fi gasita si deschisa public in VIASEE."
          action={<span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${visibility.className}`}>{visibility.label}</span>}
        />
        <SettingsRow
          title="Controlul profilului"
          description="Arata nivelul de verificare si control acordat furnizorului."
          action={<span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{controlLabel}</span>}
        />
      </SettingsSection>

      <SettingsSection title="Preferinte workspace" description="Preferintele sunt personale si sunt salvate numai pe acest dispozitiv.">
        <SettingsRow
          title="La deschiderea workspace-ului"
          description="Alege daca VIASEE deschide ultima locatie folosita sau o locatie fixa."
          action={(
            <div className="relative min-w-[230px]">
              <select
                value={preferences.providerLocationMode}
                onChange={(event) => setProviderLocationMode(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm font-medium outline-none transition focus:border-foreground/30"
              >
                <option value="last">Ultima locatie folosita</option>
                <option value="fixed">O locatie fixa</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}
        />
        {preferences.providerLocationMode === "fixed" && (
          <SettingsRow
            title="Locatie fixa"
            description="Aceasta locatie va fi deschisa prima data cand intri in workspace."
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

      <SettingsSection title="Cont si securitate" description="Datele personale, parola si confidentialitatea sunt administrate separat de organizatie.">
        <SettingsRow
          title="Cont personal VIASEE"
          description={user?.email || "Cont autentificat"}
          action={<CompactButton onClick={() => onSwitchMode?.("personal")}>Setarile contului <ExternalLink className="h-3.5 w-3.5" /></CompactButton>}
        />
      </SettingsSection>

      <SettingsSection title="Zona de pericol" description={`Actiunile se aplica locatiei ${locationLabel(selectedLocation)}, nu contului personal VIASEE.`} danger>
        <SettingsRow
          title="Ascunde temporar locatia"
          description="Locatia dispare din cautare si din profilul public, dar ramane in workspace si poate fi republicata."
          action={<CompactButton danger onClick={() => setPendingAction("hide")}><EyeOff className="h-3.5 w-3.5" /> Ascunde locatia</CompactButton>}
        />
        <SettingsRow
          title="Inchide locatia in VIASEE"
          description="Locatia este retrasa din director si arhivata dupa verificare. Istoricul este pastrat."
          action={<CompactButton danger onClick={() => setPendingAction("close")}><Archive className="h-3.5 w-3.5" /> Solicita inchiderea</CompactButton>}
        >
          {isLastActiveLocation && (
            <p className="mt-2 flex max-w-2xl items-start gap-2 text-xs leading-relaxed text-amber-800">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Aceasta este ultima locatie activa a organizatiei.
            </p>
          )}
        </SettingsRow>
      </SettingsSection>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Solicitarile de ascundere si inchidere sunt verificate manual pentru a proteja membrii asociati, datele publice si istoricul de audit.
      </p>

      {pendingAction && (
        <ConfirmationModal
          action={pendingAction}
          location={selectedLocation}
          isLastActiveLocation={isLastActiveLocation}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmLifecycleRequest}
        />
      )}
    </div>
  );
}
