import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Clock, Pencil, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PCS_LABELS } from "@/lib/directoryOpsCatalog";
import { DAY_KEYS, DAY_LABELS } from "../../../../shared/providerOpeningHours.js";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

// Campuri text editabile manual de admin - deliberat NU includ nume, adresa sau tipul
// de furnizor: acelea ating potrivirea geografica si medicala (SIRUTA, capacitate
// medical/optic) si merita fluxul de corectie/revendicare, nu un patch rapid.
// Orarul e tratat separat (vezi butonul "Orar"), pentru ca profilul public foloseste
// un camp structurat pe zile (opening_hours_json), nu text liber.
const EDIT_FIELDS = [
  { key: "phone_public", label: "Telefon", placeholder: "07xx xxx xxx" },
  { key: "website", label: "Website", placeholder: "https://..." },
  { key: "public_email", label: "Email", placeholder: "contact@..." },
  { key: "description", label: "Descriere", placeholder: "Cateva propozitii despre locatie", multiline: true },
];

function safeParseHours(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function defaultWeekly(existingJson) {
  const parsed = safeParseHours(existingJson);
  const weekly = parsed.weekly && typeof parsed.weekly === "object" ? parsed.weekly : {};
  return Object.fromEntries(
    DAY_KEYS.map((key) => [
      key,
      weekly[key] && typeof weekly[key] === "object"
        ? { open: Boolean(weekly[key].open), from: weekly[key].from || "09:00", to: weekly[key].to || "18:00" }
        : { open: false, from: "09:00", to: "18:00" },
    ]),
  );
}

const FILTERS = [
  { key: "all", label: "Toate" },
  { key: "problems", label: "Status nealiniat" },
  { key: "directory", label: "Profiluri directory" },
  { key: "verified", label: "Verificate" },
  { key: "suspended", label: "Suspendate" },
];

function getStatusIssues(location) {
  const issues = [];
  if (location.status === "publicata" && location.profile_control_status !== "verified") {
    issues.push("Locatia este publicata, dar profilul nu este verificat.");
  }
  if (location.profile_control_status === "verified" && location.status !== "publicata") {
    issues.push("Profilul este verificat, dar locatia nu este publicata.");
  }
  if (location.status === "publicata" && location.public_visibility_status !== "approved") {
    issues.push(`Vizibilitatea legacy este ${location.public_visibility_status || "lipsa"}.`);
  }
  if (
    location.claim_verification_status === "approved"
    && !["claimed", "verified"].includes(location.profile_control_status)
  ) {
    issues.push("Revendicarea este aprobata, dar controlul profilului nu reflecta aprobarea.");
  }
  if (location.pending_changes) issues.push("Campul legacy pending_changes este inca populat.");
  return issues;
}

function canonicalLabel(location) {
  if (location.profile_control_status === "suspended" || location.status === "suspendata") {
    return "Suspendata";
  }
  if (location.profile_control_status === "verified" && location.status === "publicata") {
    return "Publicata si verificata";
  }
  if (location.profile_control_status === "verified") return "Verificata, nepublicata";
  if (location.profile_control_status === "claimed") return "Revendicata";
  return "Profil directory";
}

function StatusBadge({ label, tone = "neutral" }) {
  const classes = {
    green: "border-green-200 bg-green-50 text-green-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-border bg-background text-muted-foreground",
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${classes[tone]}`}>
      {label}
    </span>
  );
}

export default function DirOpsProfiles() {
  const [locations, setLocations] = useState(null);
  const [organizations, setOrganizations] = useState({});
  const [action, setAction] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [hoursAction, setHoursAction] = useState(null);
  const [weeklyForm, setWeeklyForm] = useState({});
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [locationRows, organizationRows] = await Promise.all([
        base44.entities.ProviderLocation.list("-updated_date", 500),
        base44.entities.ProviderOrganization.list("name", 500),
      ]);
      setLocations(locationRows);
      setOrganizations(
        Object.fromEntries(organizationRows.map((organization) => [organization.id, organization])),
      );
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut incarca profilurile.");
      setLocations([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (note) => {
    setError("");
    try {
      await base44.functions.invoke("directoryOps", {
        action: action.type === "verify" ? "verify_profile" : "suspend_profile",
        location_id: action.locationId,
        note,
      });
      setAction(null);
      await load();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Actiunea nu a putut fi aplicata.");
    }
  };

  // Editare rapida de admin: propune modificarea (updateProviderLocation, functia
  // deja folosita de furnizori in workspace-ul lor) apoi o aproba imediat, in acelasi
  // pas (reviewProfileChanges, deja folosita de admin la revizuirea modificarilor
  // propuse de furnizori). Refolosim ambele functii existente si testate, in loc sa
  // scriem logica de scriere de la zero.
  const runEdit = async (note) => {
    setError("");
    const fields = {};
    for (const field of EDIT_FIELDS) {
      if (field.key === "opening_hours") continue;
      fields[field.key] = String(editForm[field.key] || "").trim();
    }
    const openingHours = String(editForm.opening_hours || "").trim();

    const staged = await base44.functions.invoke("updateProviderLocation", {
      location_id: action.locationId,
      direct: { opening_hours: openingHours },
      staged: { fields },
    });
    if (staged?.data?.error) throw new Error(staged.data.error);

    const applied = await base44.functions.invoke("directoryOps", {
      __function: "reviewProfileChanges",
      payload: {
        location_id: action.locationId,
        decision: "aproba",
        notes: note || "Editat direct de admin",
      },
    });
    if (applied?.data?.error) throw new Error(applied.data.error);

    setAction(null);
    setEditForm({});
    await load();
  };

  // Foloseste noua functie exclusiv de admin (adminSetLocationHours), construita azi
  // special pentru acest caz: saveProviderRoutineProfile (folosita de furnizori) cere
  // ProviderMembership, pe care admin-ul nu o are pe locatiile din import.
  const runHours = async (note) => {
    const applied = await base44.functions.invoke("directoryOps", {
      __function: "adminSetLocationHours",
      payload: { location_id: hoursAction.locationId, weekly: weeklyForm, note },
    });
    if (applied?.data?.error) throw new Error(applied.data.error);
    setHoursAction(null);
    setWeeklyForm({});
    await load();
  };

  const visibleLocations = useMemo(() => {
    if (!locations) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return locations.filter((location) => {
      const issues = getStatusIssues(location);
      if (filter === "problems" && issues.length === 0) return false;
      if (filter === "directory" && (location.profile_control_status || "directory") !== "directory") return false;
      if (filter === "verified" && location.profile_control_status !== "verified") return false;
      if (
        filter === "suspended"
        && location.profile_control_status !== "suspended"
        && location.status !== "suspendata"
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const organization = organizations[location.organization_id];
      return [
        location.name,
        location.public_display_name,
        location.city,
        location.county,
        organization?.name,
        organization?.public_display_name,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [filter, locations, organizations, query]);

  return (
    <div className="space-y-4">
      <AdminCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filter === item.key
                    ? "bg-foreground text-background"
                    : "border border-border bg-background hover:bg-secondary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-2 lg:w-auto lg:min-w-64">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cauta organizatie sau locatie"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
        </div>
      </AdminCard>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {!locations && <p className="text-sm text-muted-foreground">Se incarca...</p>}
      {locations && visibleLocations.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={Building2}
            title="Niciun profil pentru filtrul selectat."
            subtitle="Schimba filtrul sau termenul de cautare."
          />
        </AdminCard>
      )}

      {visibleLocations.map((location) => {
        const pcs = location.profile_control_status || "directory";
        const organization = organizations[location.organization_id];
        const issues = getStatusIssues(location);
        const canonical = canonicalLabel(location);
        const canonicalTone = canonical === "Publicata si verificata"
          ? "green"
          : canonical === "Suspendata"
            ? "red"
            : canonical === "Revendicata"
              ? "blue"
              : "neutral";

        return (
          <AdminCard key={location.id} className="p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1 sm:min-w-[260px]">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="break-words text-sm font-bold">
                    {location.public_display_name || location.name}
                  </div>
                  <StatusBadge label={canonical} tone={canonicalTone} />
                  {issues.length > 0 && (
                    <StatusBadge label={`${issues.length} neconcordante`} tone="amber" />
                  )}
                </div>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  {organization?.public_display_name || organization?.name || "Organizatie necunoscuta"}
                  {" · "}
                  {location.locality_name || location.city || "Localitate lipsa"}
                  {location.county_name || location.county
                    ? `, ${location.county_name || location.county}`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <StatusBadge
                    label={`Publicare: ${location.status || "lipsa"}`}
                    tone={location.status === "publicata" ? "green" : location.status === "suspendata" ? "red" : "neutral"}
                  />
                  <StatusBadge
                    label={`Control: ${PCS_LABELS[pcs] || pcs}`}
                    tone={pcs === "verified" ? "green" : pcs === "claimed" ? "blue" : pcs === "suspended" ? "red" : "neutral"}
                  />
                  <StatusBadge
                    label={`Revendicare: ${location.claim_verification_status || "none"}`}
                    tone={location.claim_verification_status === "approved" ? "green" : location.claim_verification_status === "pending" ? "amber" : "neutral"}
                  />
                  <StatusBadge
                    label={`Activitate: ${location.active_status || "lipsa"}`}
                    tone={location.active_status === "activa" ? "green" : "neutral"}
                  />
                </div>
                {issues.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5" /> Statusuri de verificat
                    </div>
                    <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-amber-900">
                      {issues.map((issue) => <li key={issue}>- {issue}</li>)}
                    </ul>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Sursa:{" "}
                  {location.source_url ? (
                    <a
                      href={location.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all underline"
                    >
                      {location.source_url}
                    </a>
                  ) : (
                    "lipsa"
                  )}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setEditForm({
                      phone_public: location.phone_public || "",
                      website: location.website || "",
                      public_email: location.public_email || "",
                      opening_hours: location.opening_hours || "",
                      description: location.description || "",
                    });
                    setAction({ locationId: location.id, type: "edit" });
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary sm:rounded-full"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editeaza
                </button>
                {pcs !== "verified" && (
                  <button
                    type="button"
                    onClick={() => setAction({ locationId: location.id, type: "verify" })}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary sm:rounded-full"
                  >
                    Verifica profil
                  </button>
                )}
                {pcs !== "suspended" && (
                  <button
                    type="button"
                    onClick={() => setAction({ locationId: location.id, type: "suspend" })}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-destructive hover:bg-secondary sm:rounded-full"
                  >
                    Suspenda
                  </button>
                )}
              </div>
            </div>
          </AdminCard>
        );
      })}

      {action && action.type === "edit" && (
        <DirOpsActionNote
          title="Editare rapida profil"
          onConfirm={runEdit}
          onCancel={() => { setAction(null); setEditForm({}); }}
          noteOptional
        >
          <div className="space-y-3">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
              Modificarea se aplica imediat, direct pe profilul public. Numele, adresa si tipul de furnizor nu sunt editabile aici — folositi fluxul de corectie pentru acestea.
              <br /><br />
              <strong>Orar:</strong> acest camp e ignorat pe profilul public daca locatia are deja un program structurat pe zile (orice locatie revendicata sau editata de furnizor). Functioneaza sigur doar pentru profiluri neatinse inca, din import.
            </p>
            {EDIT_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-semibold text-foreground">{field.label}</label>
                {field.multiline ? (
                  <textarea
                    value={editForm[field.key] || ""}
                    onChange={(event) => setEditForm((form) => ({ ...form, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
                  />
                ) : (
                  <input
                    value={editForm[field.key] || ""}
                    onChange={(event) => setEditForm((form) => ({ ...form, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
                  />
                )}
              </div>
            ))}
          </div>
        </DirOpsActionNote>
      )}

      {action && action.type !== "edit" && (
        <DirOpsActionNote
          title={action.type === "verify" ? "Verificare profil - nota obligatorie" : "Suspendare profil - nota obligatorie"}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
}
