import React, { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, ExternalLink, Mail, MapPin, Settings2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { readAccountPreferences, saveAccountPreferences } from "@/lib/accountPreferences";
import { PROFILE_CONTROL_LABELS, ROLE_LABELS } from "@/lib/workspaceStatusLabels";

function locationLabel(location) {
  return location?.public_display_name || location?.name || "Locatie";
}

function SettingsSection({ title, description, danger = false, children }) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${danger ? "border-red-200" : "border-border"}`}>
      <div className={`border-b px-5 py-4 ${danger ? "border-red-100 bg-red-50/45" : "border-border"}`}>
        <h2 className={`text-sm font-semibold ${danger ? "text-red-900" : "text-foreground"}`}>{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y divide-border/80">{children}</div>
    </section>
  );
}

function SettingsRow({ title, description, icon: Icon, action, children }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
          {children}
        </div>
      </div>
      {action && <div className="shrink-0 sm:pl-5">{action}</div>}
    </div>
  );
}

function StatusBadge({ location }) {
  const suspended = location?.profile_control_status === "suspended" || location?.status === "suspendata";
  const inactive = location?.active_status === "inactiva";
  const published = location?.status === "publicata" && !inactive && !suspended;
  const label = suspended
    ? "Suspendata"
    : inactive
      ? "Inactiva"
      : published
        ? "Publicata"
        : PROFILE_CONTROL_LABELS[location?.profile_control_status] || "Draft";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${published ? "bg-green-100 text-green-800" : suspended ? "bg-red-100 text-red-800" : "bg-secondary text-muted-foreground"}`}>
      {label}
    </span>
  );
}

export default function ProviderSettings({ user, workspace, overview, selectedLocationId, onSelectLocation, onSwitchMode }) {
  const [preferences, setPreferences] = useState(() => readAccountPreferences(user?.id));
  const locations = workspace?.locations || [];
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) || overview?.location || locations[0] || null;
  const organization = overview?.organization || workspace?.organizations?.find((item) => item.id === selectedLocation?.organization_id) || workspace?.organizations?.[0] || null;
  const organizationName = organization?.public_display_name || organization?.name || selectedLocation?.organization_name || "Organizatie";
  const role = overview?.current_user_role || workspace?.current_user_role || "";
  const isOwner = role === "organization_owner";

  const removalSubject = encodeURIComponent(`Solicitare eliminare locatie VIASEE - ${locationLabel(selectedLocation)}`);
  const removalBody = encodeURIComponent([
    "Buna ziua,",
    "",
    `Solicit eliminarea locatiei \"${locationLabel(selectedLocation)}\" din VIASEE.`,
    `ID locatie: ${selectedLocation?.id || "-"}`,
    `Organizatie: ${organizationName}`,
    `Cont solicitant: ${user?.email || "-"}`,
    "",
    "Inteleg ca aceasta solicitare elimina locatia din director si din workspace dupa verificare, fara sa stearga contul personal VIASEE.",
  ].join("\n"));
  const removalHref = `mailto:contact@viasee.ro?subject=${removalSubject}&body=${removalBody}`;

  const unpublishSubject = encodeURIComponent(`Solicitare retragere din publicare - ${locationLabel(selectedLocation)}`);
  const unpublishBody = encodeURIComponent([
    "Buna ziua,",
    "",
    `Solicit retragerea temporara din publicare a locatiei \"${locationLabel(selectedLocation)}\".`,
    `ID locatie: ${selectedLocation?.id || "-"}`,
    `Organizatie: ${organizationName}`,
    `Cont solicitant: ${user?.email || "-"}`,
    "",
    "Doresc ca locatia sa ramana in workspace, dar sa nu mai fie vizibila public pana la reactivare.",
  ].join("\n"));
  const unpublishHref = `mailto:contact@viasee.ro?subject=${unpublishSubject}&body=${unpublishBody}`;

  const selectedDefaultLocationId = useMemo(() => {
    const saved = preferences.lastProviderLocationId;
    return locations.some((location) => location.id === saved) ? saved : selectedLocationId || locations[0]?.id || "";
  }, [locations, preferences.lastProviderLocationId, selectedLocationId]);

  const setDefaultLocation = (locationId) => {
    const next = saveAccountPreferences(user?.id, {
      lastProviderLocationId: locationId,
      rememberLastLocation: true,
    });
    setPreferences(next);
    onSelectLocation?.(locationId);
  };

  const toggleRememberLocation = () => {
    setPreferences(saveAccountPreferences(user?.id, {
      rememberLastLocation: !preferences.rememberLastLocation,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Setari</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Configureaza workspace-ul furnizorului si locatia selectata. Contul personal VIASEE ramane separat.
        </p>
      </div>

      <SettingsSection title="Informatii workspace">
        <SettingsRow
          title="Organizatie"
          description="Organizatia care detine locatia selectata. Identitatea publica se modifica din Profil public."
          icon={Building2}
          action={<span className="max-w-[280px] truncate text-sm font-medium text-foreground">{organizationName}</span>}
        />

        <SettingsRow
          title="Locatia activa"
          description="Setarile si actiunile de mai jos se aplica acestei locatii."
          icon={MapPin}
          action={(
            <div className="relative min-w-[230px]">
              <select
                value={selectedLocation?.id || ""}
                onChange={(event) => onSelectLocation?.(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm font-medium outline-none transition focus:border-foreground/30"
              >
                {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}
        />

        <SettingsRow
          title="Status locatie"
          description="Statusul public si nivelul de control al profilului."
          icon={ShieldCheck}
          action={<div className="flex items-center gap-2"><StatusBadge location={selectedLocation} /><span className="text-xs text-muted-foreground">{ROLE_LABELS[role] || role || "Acces furnizor"}</span></div>}
        />
      </SettingsSection>

      <SettingsSection title="Setari generale">
        <SettingsRow
          title="Locatia implicita"
          description="Aceasta locatie va fi deschisa prima data cand intri in workspace-ul furnizorului pe acest dispozitiv."
          icon={Settings2}
          action={(
            <div className="relative min-w-[230px]">
              <select
                value={selectedDefaultLocationId}
                onChange={(event) => setDefaultLocation(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm font-medium outline-none transition focus:border-foreground/30"
              >
                {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}
        />

        <SettingsRow
          title="Retine ultima locatie folosita"
          description="Cand este activata, ultima locatie deschisa devine automat locatia implicita pe acest dispozitiv."
          icon={Check}
          action={(
            <button
              type="button"
              role="switch"
              aria-checked={preferences.rememberLastLocation}
              onClick={toggleRememberLocation}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${preferences.rememberLastLocation ? "bg-foreground" : "bg-muted"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${preferences.rememberLastLocation ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          )}
        />
      </SettingsSection>

      <SettingsSection title="Cont VIASEE" description="Datele contului, parola si confidentialitatea sunt administrate separat de locatii.">
        <SettingsRow
          title={user?.email || "Cont autentificat"}
          description="Deschide setarile contului personal pentru securitate, parola si solicitari privind datele tale."
          icon={ShieldCheck}
          action={(
            <button
              type="button"
              onClick={() => onSwitchMode?.("personal")}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
            >
              Setarile contului <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        />
      </SettingsSection>

      <SettingsSection title="Zona de pericol" description="Actiunile de aici afecteaza numai locatia selectata, nu contul personal VIASEE." danger>
        <SettingsRow
          title="Retrage locatia din publicare"
          description="Locatia nu va mai fi vizibila in cautare si pe profilul public, dar ramane disponibila in workspace pentru reactivare."
          action={isOwner ? (
            <a href={unpublishHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50">
              Solicita retragerea <Mail className="h-3.5 w-3.5" />
            </a>
          ) : <span className="text-xs font-medium text-muted-foreground">Doar ownerul poate solicita</span>}
        />

        <SettingsRow
          title="Elimina locatia din VIASEE"
          description="Locatia va fi eliminata din director si nu va mai aparea in workspace dupa verificare. Contul personal ramane activ."
          icon={TriangleAlert}
          action={isOwner ? (
            <a href={removalHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50">
              Elimina locatia <Mail className="h-3.5 w-3.5" />
            </a>
          ) : <span className="text-xs font-medium text-muted-foreground">Doar ownerul poate solicita</span>}
        />
      </SettingsSection>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Retragerea si eliminarea sunt procesate manual pentru a proteja datele organizatiei, membrii asociati si istoricul de verificare.
      </p>
    </div>
  );
}
