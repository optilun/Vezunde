import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Clock, ExternalLink, Pencil, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { DAY_KEYS, DAY_LABELS } from "../../../../shared/providerOpeningHours.js";
import { ORGANIZATION_ID_PREFIX } from "@/lib/adminGlobalSearch";
import { locationStatusIssues } from "@/lib/adminLocationStatusRules";
import { profileStateOf } from "@/lib/adminLabels";
import { sourceHost, validateQuickEdit } from "@/lib/adminProfileEdit";
import { buildSearchIndex, matchesAllTokens, searchTokens } from "@/lib/adminSearch";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminSelectedId } from "@/components/admin/useAdminRoute";

// Campuri text editabile manual de admin - deliberat NU includ nume, adresa sau tipul
// de furnizor: acelea ating potrivirea geografica si medicala (SIRUTA, capacitate
// medical/optic) si merita fluxul de corectie/revendicare, nu un patch rapid.
// Orarul e tratat separat (vezi butonul "Orar"), pentru ca profilul public foloseste
// un camp structurat pe zile (opening_hours_json), nu text liber.
const EDIT_FIELDS = [
  { key: "phone_public", label: "Telefon", placeholder: "07xx xxx xxx" },
  { key: "website", label: "Website", placeholder: "https://..." },
  { key: "public_email", label: "Email", placeholder: "contact@..." },
  { key: "description", label: "Descriere", placeholder: "Câteva propoziții despre locație", multiline: true },
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

// Actiunile de control pe profil si titlul ferestrei cu nota obligatorie (2026-10-01: a aparut
// "Ridica suspendarea", pentru ca "Verifica" nu mai scoate un profil din suspendare).
const PROFILE_ACTIONS = {
  verify: "verify_profile",
  suspend: "suspend_profile",
  unsuspend: "unsuspend_profile",
};
const PROFILE_ACTION_TITLES = {
  verify: "Verificare profil — notă obligatorie",
  suspend: "Suspendare profil — notă obligatorie",
  unsuspend: "Ridicarea suspendării — notă obligatorie",
};

const PAGE_SIZE = 50;

const ACTION_BUTTON = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary sm:rounded-full";

// 2026-10-07 (audit admin): "De verificat" arata doar contradictiile reale (vezi
// src/lib/adminLocationStatusRules.js); un profil din director, publicat si nerevendicat NU mai e
// marcat. Lista se afiseaza treptat (50 odata), fiecare card are o singura insigna de stare si
// link catre pagina publica.
export default function DirOpsProfiles() {
  const [locations, setLocations] = useState(null);
  const [organizations, setOrganizations] = useState({});
  const [action, setAction] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [hoursAction, setHoursAction] = useState(null);
  const [weeklyForm, setWeeklyForm] = useState({});
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [error, setError] = useState("");
  // Ajuns din căutarea globală (?id=locație sau ?id=org:organizație): se arată doar elementul cerut,
  // cu un singur click înapoi la lista completă.
  const [focusId, setFocusId] = useAdminSelectedId();

  const load = async () => {
    setError("");
    try {
      const [locationRows, organizationRows] = await Promise.all([
        // Limita ridicata la 5000 (era 500) - descoperit 2026-08-06 ca 500 trunchia
        // silentios lista, ascunzand pana la ~30 de locatii din vizualizarea admin.
        base44.entities.ProviderLocation.list("-updated_date", 5000),
        base44.entities.ProviderOrganization.list("name", 5000),
      ]);
      setLocations(locationRows);
      setOrganizations(
        Object.fromEntries(organizationRows.map((organization) => [organization.id, organization])),
      );
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut încărca profilurile.");
      setLocations([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Eroarea se lasa sa urce: DirOpsActionNote o afiseaza in dialog si reactiveaza butoanele. Inainte
  // era inghitita aici, iar dialogul ramanea blocat pe "Se aplica..." dupa un esec.
  const run = async (note) => {
    setError("");
    const response = await base44.functions.invoke("directoryOps", {
      action: PROFILE_ACTIONS[action.type] || "suspend_profile",
      location_id: action.locationId,
      note,
    });
    if (response?.data?.error) throw new Error(response.data.error);
    setAction(null);
    await load();
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
    const problems = validateQuickEdit(fields);
    if (problems.length > 0) throw new Error(problems.join(" "));
    const openingHours = String(editForm.opening_hours || "").trim();

    const staged = await base44.functions.invoke("updateProviderLocation", {
      location_id: action.locationId,
      direct: { opening_hours: openingHours },
      staged: { fields },
    });
    if (staged?.data?.error) throw new Error(staged.data.error);

    let applied;
    try {
      applied = await base44.functions.invoke("directoryOps", {
        __function: "reviewProfileChanges",
        payload: {
          location_id: action.locationId,
          decision: "aproba",
          notes: note || "Editat direct de admin",
        },
      });
    } catch (reason) {
      throw new Error(
        `Modificarea a fost pregătită, dar nu s-a putut aplica (${reason.response?.data?.error || reason.message}). Reîncearcă; până atunci locația apare la „De verificat”.`,
      );
    }
    if (applied?.data?.error) {
      throw new Error(`Modificarea a fost pregătită, dar nu s-a putut aplica (${applied.data.error}). Reîncearcă; până atunci locația apare la „De verificat”.`);
    }

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

  // Problemele se calculeaza o singura data pe lista incarcata, nu la fiecare randare a cardurilor.
  const issuesById = useMemo(() => {
    const map = new Map();
    for (const location of locations || []) map.set(location.id, locationStatusIssues(location));
    return map;
  }, [locations]);

  const counts = useMemo(() => {
    const rows = locations || [];
    let problems = 0;
    let directory = 0;
    let verified = 0;
    let suspended = 0;
    for (const location of rows) {
      if ((issuesById.get(location.id) || []).length > 0) problems += 1;
      const control = location.profile_control_status || "directory";
      if (control === "directory") directory += 1;
      if (control === "verified") verified += 1;
      if (control === "suspended" || location.status === "suspendata") suspended += 1;
    }
    return { all: rows.length, problems, directory, verified, suspended };
  }, [locations, issuesById]);

  const focus = useMemo(() => {
    if (!focusId || !locations) return null;
    if (focusId.startsWith(ORGANIZATION_ID_PREFIX)) {
      const organizationId = focusId.slice(ORGANIZATION_ID_PREFIX.length);
      const organization = organizations[organizationId];
      const members = locations.filter((location) => location.organization_id === organizationId);
      return {
        label: organization?.public_display_name || organization?.name || "",
        locations: members,
        missing: !organization && members.length === 0,
      };
    }
    const found = locations.find((location) => location.id === focusId);
    return {
      label: found ? found.public_display_name || found.name || "" : "",
      locations: found ? [found] : [],
      missing: !found,
    };
  }, [focusId, locations, organizations]);

  // Căutarea ignoră diacriticele și majusculele și cere toate cuvintele („iasi optica” găsește „Optica Demo — Iași”);
  // telefonul se găsește oricum e scris. Indexul se construiește o dată per listă încărcată.
  const searchEntries = useMemo(() => new Map(buildSearchIndex(locations || [], {
    name: (location) => location.public_display_name || location.name,
    parts: (location) => {
      const organization = organizations[location.organization_id];
      return [
        location.name,
        location.public_display_name,
        location.locality_name,
        location.city,
        location.county_name,
        location.county,
        location.address,
        organization?.name,
        organization?.public_display_name,
      ];
    },
    phones: (location) => [location.phone_public],
  }).map((entry) => [entry.item.id, entry.text])), [locations, organizations]);

  const visibleLocations = useMemo(() => {
    if (!locations) return [];
    if (focus) return focus.locations;
    const tokens = searchTokens(query);
    return locations.filter((location) => {
      if (filter === "problems" && (issuesById.get(location.id) || []).length === 0) return false;
      if (filter === "directory" && (location.profile_control_status || "directory") !== "directory") return false;
      if (filter === "verified" && location.profile_control_status !== "verified") return false;
      if (
        filter === "suspended"
        && location.profile_control_status !== "suspended"
        && location.status !== "suspendata"
      ) {
        return false;
      }
      return tokens.length === 0 || matchesAllTokens(searchEntries.get(location.id) || "", tokens);
    });
  }, [filter, focus, issuesById, locations, query, searchEntries]);

  const page = visibleLocations.slice(0, shown);

  const changeFilter = (next) => { setFilter(next); setShown(PAGE_SIZE); };
  const changeQuery = (next) => { setQuery(next); setShown(PAGE_SIZE); };

  const chips = [
    { key: "all", label: "Toate", count: counts.all },
    { key: "problems", label: "De verificat", count: counts.problems },
    { key: "directory", label: "Din director", count: counts.directory },
    { key: "verified", label: "Verificate", count: counts.verified },
    { key: "suspended", label: "Suspendate", count: counts.suspended },
  ];

  return (
    <div className="space-y-4">
      {focus ? (
        <AdminNotice tone={focus.missing ? "warning" : "info"}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {focus.missing
                ? "Nu am găsit locația sau organizația cerută."
                : <>Afișez doar <strong>{focus.label || "elementul căutat"}</strong>{focus.locations.length > 1 ? ` (${focus.locations.length} locații)` : ""}.</>}
            </span>
            <button
              type="button"
              onClick={() => setFocusId("")}
              className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Arată toate profilurile
            </button>
          </span>
        </AdminNotice>
      ) : (
      <AdminCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <AdminChips options={chips} value={filter} onChange={changeFilter} label="Filtrează profilurile" />
          <label className="flex w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-2 lg:w-72 lg:shrink-0">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="Caută nume, oraș, adresă sau telefon"
              aria-label="Caută organizație sau locație"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
        </div>
      </AdminCard>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {!locations && <AdminLoading label="Se încarcă profilurile…" />}
      {locations && visibleLocations.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={Building2}
            title="Niciun profil pentru filtrul ales."
            subtitle="Schimbă filtrul sau termenul de căutare."
          />
        </AdminCard>
      )}

      {page.map((location) => {
        const pcs = location.profile_control_status || "directory";
        const organization = organizations[location.organization_id];
        const issues = issuesById.get(location.id) || [];
        const state = profileStateOf(location);
        const host = sourceHost(location.source_url);

        return (
          <AdminCard key={location.id} className="p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1 sm:min-w-[260px]">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="break-words text-sm font-bold">
                    {location.public_display_name || location.name}
                  </div>
                  <StatusBadge label={state.label} tone={state.tone} />
                  {location.active_status === "inactiva" && <StatusBadge label="Inactivă" />}
                  {location.claim_verification_status === "pending" && <StatusBadge label="Revendicare în verificare" tone="warning" />}
                </div>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  {organization?.public_display_name || organization?.name || "Organizație necunoscută"}
                  {" · "}
                  {location.locality_name || location.city || "Localitate lipsă"}
                  {location.county_name || location.county
                    ? `, ${location.county_name || location.county}`
                    : ""}
                </p>
                {issues.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {issues.map((issue) => (
                      <li
                        key={issue.code}
                        className={`flex items-start gap-1.5 text-xs ${issue.severity === "error" ? "text-danger" : "text-warning"}`}
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {issue.text}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Sursă:{" "}
                  {location.source_url ? (
                    <a
                      href={location.source_url}
                      target="_blank"
                      rel="noreferrer"
                      title={location.source_url}
                      className="underline underline-offset-2"
                    >
                      {host}
                    </a>
                  ) : (
                    "lipsă"
                  )}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                {location.status === "publicata" && (
                  <Link to={`/furnizor/${location.id}`} target="_blank" rel="noreferrer" className={ACTION_BUTTON}>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Vezi pe site
                  </Link>
                )}
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
                  className={ACTION_BUTTON}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editează
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeeklyForm(defaultWeekly(location.opening_hours_json));
                    setHoursAction({ locationId: location.id });
                  }}
                  className={ACTION_BUTTON}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Program
                </button>
                {/* 2026-10-01: un profil suspendat nu se mai poate "verifica" direct; intai se ridica suspendarea. */}
                {pcs === "suspended" && (
                  <button
                    type="button"
                    onClick={() => setAction({ locationId: location.id, type: "unsuspend" })}
                    className={ACTION_BUTTON}
                  >
                    Ridică suspendarea
                  </button>
                )}
                {pcs !== "verified" && pcs !== "suspended" && (
                  <button
                    type="button"
                    onClick={() => setAction({ locationId: location.id, type: "verify" })}
                    className={ACTION_BUTTON}
                  >
                    Verifică profilul
                  </button>
                )}
                {pcs !== "suspended" && (
                  <button
                    type="button"
                    onClick={() => setAction({ locationId: location.id, type: "suspend" })}
                    className={`${ACTION_BUTTON} text-danger`}
                  >
                    Suspendă
                  </button>
                )}
              </div>
            </div>
          </AdminCard>
        );
      })}

      {visibleLocations.length > page.length && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-xs text-muted-foreground">Se afișează {page.length} din {visibleLocations.length}</p>
          <button
            type="button"
            onClick={() => setShown((current) => current + PAGE_SIZE)}
            className="inline-flex min-h-10 items-center rounded-full border border-border bg-card px-5 text-xs font-semibold hover:bg-secondary"
          >
            Arată încă {Math.min(PAGE_SIZE, visibleLocations.length - page.length)}
          </button>
        </div>
      )}

      {action && action.type === "edit" && (
        <DirOpsActionNote
          title="Editare rapidă profil"
          onConfirm={runEdit}
          onCancel={() => { setAction(null); setEditForm({}); }}
          noteOptional
        >
          <div className="space-y-3">
            <p className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-[11px] leading-relaxed text-warning">
              Se aplică imediat pe profilul public. Numele, adresa și tipul se schimbă prin fluxul de corecție; programul, din „Program”.
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
          title={PROFILE_ACTION_TITLES[action.type] || PROFILE_ACTION_TITLES.suspend}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}

      {hoursAction && (
        <DirOpsActionNote
          title="Program săptămânal"
          onConfirm={runHours}
          onCancel={() => { setHoursAction(null); setWeeklyForm({}); }}
          noteOptional
        >
          <div className="space-y-2">
            <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Setează doar zilele confirmate; restul rămân „Închis”.
            </p>
            {DAY_KEYS.map((dayKey) => {
              const day = weeklyForm[dayKey] || { open: false, from: "09:00", to: "18:00" };
              return (
                <div key={dayKey} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <label className="flex min-w-24 items-center gap-2 text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={day.open}
                      onChange={(event) => setWeeklyForm((form) => ({
                        ...form,
                        [dayKey]: { ...day, open: event.target.checked },
                      }))}
                    />
                    {DAY_LABELS[dayKey]}
                  </label>
                  {day.open ? (
                    <div className="flex flex-1 items-center gap-1.5">
                      <input
                        type="time"
                        value={day.from}
                        onChange={(event) => setWeeklyForm((form) => ({
                          ...form,
                          [dayKey]: { ...day, from: event.target.value },
                        }))}
                        className="min-w-0 flex-1 rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-foreground/40"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={day.to}
                        onChange={(event) => setWeeklyForm((form) => ({
                          ...form,
                          [dayKey]: { ...day, to: event.target.value },
                        }))}
                        className="min-w-0 flex-1 rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-foreground/40"
                      />
                    </div>
                  ) : (
                    <span className="flex-1 text-xs text-muted-foreground">Închis</span>
                  )}
                </div>
              );
            })}
          </div>
        </DirOpsActionNote>
      )}
    </div>
  );
}
