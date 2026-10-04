import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { buildGoogleMapsDirectionsUrl } from "@/lib/maps";
import LocationPinMap from "@/components/maps/LocationPinMap";
import { locationCoordinates, locationPositionLabel } from "../../../../shared/locationMapPosition.js";
import {
  deriveProviderLocationState,
  deriveSubmissionState,
} from "@/lib/providerWorkspaceState";
import { hasPublishedSectionChanges, sameSubmissionPayload } from "../../../../shared/providerWorkspaceSubmissionComparison.js";
import { formatStreetAddress } from "@/lib/addressDisplay";

const inputCls =
  "w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-[16px] outline-none transition-colors focus:border-foreground/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]";

function cleanNumber(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return "";
  const number = Number(raw);
  return Number.isFinite(number) ? String(number) : raw;
}

function numericOrEmpty(value) {
  const raw = cleanNumber(value);
  if (!raw) return "";
  const number = Number(raw);
  return Number.isFinite(number) ? number : "";
}

function getCoordinateValidation(values = {}) {
  const rawLat = String(values.lat ?? "").trim();
  const rawLng = String(values.lng ?? "").trim();
  const lat = numericOrEmpty(values.lat);
  const lng = numericOrEmpty(values.lng);
  const issues = [];

  if ((rawLat && !rawLng) || (!rawLat && rawLng)) {
    issues.push(
      "Completează și latitudinea, și longitudinea pentru poziția pe hartă.",
    );
  }
  if (rawLat && lat === "") issues.push("Latitudinea trebuie să fie un număr valid.");
  if (rawLng && lng === "") issues.push("Longitudinea trebuie să fie un număr valid.");
  if (lat !== "" && (lat < -90 || lat > 90)) {
    issues.push("Latitudinea trebuie să fie între -90 și 90.");
  }
  if (lng !== "" && (lng < -180 || lng > 180)) {
    issues.push("Longitudinea trebuie să fie între -180 și 180.");
  }

  if (lat === 0 && lng === 0) issues.push("Alege poziția reală a locației pe hartă.");
  return { issues, lat, lng };
}

function deriveLocationDataStatus(
  activeSubmission,
  latestSubmission,
  locationState,
  location,
) {
  const activeState = deriveSubmissionState(activeSubmission);
  if (activeState) return activeState;

  if (latestSubmission?.status === "approved") {
    return {
      label: "Date publice aprobate",
      className: "border border-[#ccd2ba] bg-[#dfe3d2] text-[#1c1c1c]",
      editable: false,
      pendingReview: false,
    };
  }

  if (latestSubmission?.status === "rejected") {
    return {
      label: "Ultima modificare respinsă",
      className: "border border-[#e1bda8] bg-[#efd5c5] text-[#1c1c1c]",
      editable: false,
      pendingReview: false,
    };
  }

  if (locationState.published) {
    return {
      label: "Date publice publicate",
      className: "border border-[#ccd2ba] bg-[#dfe3d2] text-[#1c1c1c]",
      editable: false,
      pendingReview: false,
    };
  }

  const hasIdentity = Boolean(
    String(location?.public_display_name || location?.name || "").trim(),
  );
  const hasAddress = Boolean(String(location?.address || "").trim());
  const hasContact = Boolean(
    String(
      location?.public_phone ||
        location?.phone_public ||
        location?.public_email ||
        "",
    ).trim(),
  );

  if (hasIdentity && hasAddress && hasContact) {
    return {
      label: "Date publice completate",
      className: "border border-border bg-secondary text-foreground",
      editable: false,
      pendingReview: false,
    };
  }

  return {
    label: "Date publice incomplete",
    className: "border border-[#dac69b] bg-[#eadcba] text-[#1c1c1c]",
    editable: false,
    pendingReview: false,
  };
}

function locationPhoto(location) {
  return (
    location?.cover_photo_url ||
    location?.primary_photo_url ||
    location?.image_url ||
    location?.photo_url ||
    ""
  );
}

function LocationCard({ location, active, onSelect }) {
  const state = deriveProviderLocationState(location);
  const completeness = Number.isFinite(Number(location.profile_completeness))
    ? Number(location.profile_completeness)
    : 0;
  const photo = locationPhoto(location);
  const name = location.public_display_name || location.name || "Locație";
  const locality = location.locality_name || location.city || "Localitate lipsă";

  return (
    <button
      type="button"
      onClick={() => onSelect(location.id)}
      className={`group min-w-0 overflow-hidden rounded-[14px] border bg-background text-left transition-colors ${
        active
          ? "border-[#345bc8] ring-2 ring-[#345bc8]/10"
          : "border-foreground/20 hover:border-foreground/45"
      }`}
    >
      <div className="relative aspect-[16/8.5] overflow-hidden border-b border-foreground/10 bg-secondary/45">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.015]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{
              background:
                "linear-gradient(180deg, #DCE4F2 0%, #EEF0F4 55%, #F7F2E8 100%)",
            }}
          >
            <MapPin className="h-7 w-7 text-[#53627d]" />
          </div>
        )}
        {active && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#345bc8] shadow-sm backdrop-blur-sm">
            <CheckCircle2 className="h-3.5 w-3.5" /> Selectată
          </span>
        )}
      </div>

      <div className="px-4 py-3.5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">{name}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">{locality}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${state.activityClassName}`}
          >
            {state.activityLabel}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3 text-xs">
          <span className="text-muted-foreground">
            Completitudine <b className="text-foreground">{completeness}%</b>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}

function DetailLine({ icon: Icon, label, value, href }) {
  const content = value || "Lipsește";
  return (
    <div className="min-w-0 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      {href && value ? (
        <a
          href={href}
          className="mt-1.5 block truncate text-sm font-bold text-foreground underline decoration-foreground/25 underline-offset-4"
        >
          {content}
        </a>
      ) : (
        <div
          className={`mt-1.5 break-words text-sm font-bold leading-relaxed ${
            value ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// Tonurile din paleta de categorii: fiecare modul isi are culoarea lui, ca sa se distinga
// dintr-o privire in loc sa fie patru carduri albe identice.
export const CONFIGURE_TONES = {
  servicii: { border: "#ccd2ba", bg: "#dfe3d2" },
  program: { border: "#dac69b", bg: "#eadcba" },
  specialisti: { border: "#d4c6d8", bg: "#e8e0ea" },
  fotografie: { border: "#e1bda8", bg: "#efd5c5" },
};

const CONFIGURE_GRAIN = {
  backgroundImage: "url('/images/home/viasee-technical-grain.svg')",
  backgroundSize: "180px 180px",
};

function ConfigureCard({ icon: Icon, title, text, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={tone ? { borderColor: tone.border, backgroundColor: tone.bg } : undefined}
      className="relative min-h-28 overflow-hidden rounded-[14px] border border-foreground/20 bg-background p-4 text-left transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(34,30,24,0.07)] motion-reduce:transform-none"
    >
      <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={CONFIGURE_GRAIN} />
      <div className="relative z-10 flex h-full items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/70">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">{title}</div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {text}
          </p>
          <div className="mt-auto pt-3 text-sm font-bold underline underline-offset-4">
            Configurează
          </div>
        </div>
      </div>
    </button>
  );
}

function defaultValues(location) {
  return {
    public_display_name: location?.public_display_name || location?.name || "",
    address: location?.address || "",
    public_phone: location?.public_phone || location?.phone_public || "",
    public_email: location?.public_email || "",
    lat: location?.lat ?? "",
    lng: location?.lng ?? "",
    place_id: location?.place_id || "",
    map_precision: location?.map_precision === "exact" ? "exact" : "approximate",
  };
}

export default function ProviderLocations({
  workspace,
  selectedLocationId,
  onSelect,
  onRefresh,
  onOpenModule,
}) {
  const locations = workspace.locations || [];
  const capabilities = new Set(workspace.current_user_capabilities || []);
  const canAddLocations = capabilities.has("organization.manage_locations");
  const canManageLocationProfile = capabilities.has("location.manage_profile");
  const canManageLocationContent = capabilities.has("location.manage_content");
  const canManageSpecialists = capabilities.has("location.manage_specialists");
  const canManageOperationalStatus = capabilities.has(
    "location.manage_operational_status",
  );
  const visibleModuleCount = [
    canManageLocationContent,
    canManageOperationalStatus,
    canManageSpecialists,
  ].filter(Boolean).length;
  const locationById = Object.fromEntries(
    locations.map((location) => [location.id, location]),
  );
  const selectedLocation =
    locationById[selectedLocationId] || locations[0] || null;

  const [draft, setDraft] = useState(null);
  const [latestLocationSubmission, setLatestLocationSubmission] = useState(null);
  const [values, setValues] = useState(defaultValues(selectedLocation));
  const [showAdvancedMap, setShowAdvancedMap] = useState(false);
  const [showPublicMap, setShowPublicMap] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const coordinateValidation = useMemo(
    () => getCoordinateValidation(values),
    [values],
  );
  const draftState = deriveSubmissionState(draft);
  const pendingReview = draftState?.pendingReview === true;
  const hasUnsavedChanges = Boolean(draft && !sameSubmissionPayload(
    "location_details",
    values,
    { ...defaultValues(selectedLocation), ...(() => { try { return JSON.parse(draft.payload_json || "{}"); } catch { return {}; } })() },
  ));
  const hasCoordinateIssues = coordinateValidation.issues.length > 0;

  const previewLocation = useMemo(() => {
    if (!selectedLocation) return null;
    const lat = numericOrEmpty(values.lat);
    const lng = numericOrEmpty(values.lng);
    return {
      ...selectedLocation,
      public_display_name:
        values.public_display_name ||
        selectedLocation.public_display_name ||
        selectedLocation.name,
      name: values.public_display_name || selectedLocation.name,
      address: values.address,
      public_phone: values.public_phone,
      phone_public: values.public_phone,
      public_email: values.public_email,
      lat: lat !== "" ? lat : null,
      lng: lng !== "" ? lng : null,
      place_id: values.place_id || "",
      map_precision: values.map_precision,
    };
  }, [selectedLocation, values]);

  const mapUrl = previewLocation ? buildGoogleMapsDirectionsUrl(previewLocation) : "";
  const hasValidPin = Boolean(locationCoordinates(previewLocation));
  const hasExactPin = hasValidPin && values.map_precision === "exact";
  const pinLabel = locationPositionLabel(previewLocation);
  const editPosition = ({ lat, lng }) => {
    setValues((current) => ({ ...current, lat, lng, map_precision: "approximate" }));
  };
  const locationCount = locations.length;
  const hasMultipleLocations = locationCount > 1;
  const selectedLocationName =
    previewLocation?.public_display_name || previewLocation?.name || "Locație";
  const selectedState = deriveProviderLocationState(selectedLocation || {});
  const locationDataState = deriveLocationDataStatus(
    draft,
    latestLocationSubmission,
    selectedState,
    selectedLocation,
  );

  const loadDraft = async () => {
    if (!selectedLocation?.id) return;
    if (!canManageLocationProfile) {
      setDraft(null);
      setLatestLocationSubmission(null);
      setValues(defaultValues(selectedLocation));
      return;
    }

    const response = await base44.functions
      .invoke("submitProviderWorkspaceChange", {
        action: "list_mine",
        location_id: selectedLocation.id,
      })
      .catch(() => ({ data: { submissions: [] } }));
    const locationSubmissions = (response.data?.submissions || []).filter(
      (submission) => submission.section === "location_details",
    );
    const own = locationSubmissions.find((submission) =>
      ["draft", "needs_more_info", "pending_review"].includes(
        submission.status,
      ),
    );
    setDraft(own || null);
    setLatestLocationSubmission(locationSubmissions[0] || null);

    if (own) {
      try {
        const payload = JSON.parse(own.payload_json || "{}");
        setValues({ ...defaultValues(selectedLocation), ...payload });
      } catch (_error) {
        setValues(defaultValues(selectedLocation));
      }
    } else {
      setValues(defaultValues(selectedLocation));
    }
  };

  useEffect(() => {
    void loadDraft();
    setMessage("");
    setShowAdvancedMap(false);
    setShowPublicMap(false);
    setEditOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- se reincarca doar la schimbarea locatiei alese sau a dreptului de editare
  }, [selectedLocation?.id, canManageLocationProfile]);

  useEffect(() => {
    if (!editOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setEditOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editOpen]);

  const saveDraft = async () => {
    if (!selectedLocation?.id) return;
    if (hasCoordinateIssues) {
      setMessage(coordinateValidation.issues[0]);
      return;
    }

    setSaving(true);
    setMessage("");
    const action =
      draft && draft.status !== "pending_review"
        ? "update_draft"
        : "create_draft";
    const lat = numericOrEmpty(values.lat);
    const lng = numericOrEmpty(values.lng);
    const payload = {
      public_display_name: values.public_display_name || "",
      address: values.address || "",
      public_phone: values.public_phone || "",
      public_email: values.public_email || "",
      lat: lat === "" ? "" : lat,
      lng: lng === "" ? "" : lng,
      place_id: values.place_id || "",
      map_precision: values.map_precision,
    };

    if (
      !hasPublishedSectionChanges(
        "location_details",
        payload,
        selectedLocation,
      )
    ) {
      setSaving(false);
      setMessage("Nu există modificări noi de salvat.");
      return;
    }

    const response = await base44.functions
      .invoke("submitProviderWorkspaceChange", {
        action,
        submission_id: draft?.id,
        location_id: selectedLocation.id,
        section: "location_details",
        payload,
      })
      .catch((error) => ({
        data: { error: error.response?.data?.error || error.message },
      }));
    setSaving(false);
    const data = response.data || {};

    if (data.error) {
      setMessage(data.error);
      return;
    }
    if (data.no_changes) {
      setMessage(data.message || "Nu există modificări noi de salvat.");
    } else if (data.duplicate || data.already_pending) {
      setMessage(
        data.message || "Această modificare este deja în verificare.",
      );
    } else if (data.resumed || data.unchanged) {
      setMessage(data.message || "Draftul existent a fost încărcat.");
    } else {
      setMessage(
        "Draft salvat. Trimite-l spre verificare când este pregătit.",
      );
    }

    await loadDraft();
    await onRefresh?.();
  };

  const submitDraft = async () => {
    if (!draft || !selectedLocation?.id) return;
    if (hasCoordinateIssues) {
      setMessage(coordinateValidation.issues[0]);
      return;
    }

    let draftPayload = {};
    try {
      draftPayload = JSON.parse(draft.payload_json || "{}");
    } catch (_error) {
      draftPayload = {};
    }

    if (
      !hasPublishedSectionChanges(
        "location_details",
        draftPayload,
        selectedLocation,
      )
    ) {
      setSaving(true);
      setMessage("");
      const closeResponse = await base44.functions
        .invoke("submitProviderWorkspaceChange", {
          action: "withdraw",
          submission_id: draft.id,
          location_id: selectedLocation.id,
          section: "location_details",
        })
        .catch((error) => ({
          data: { error: error.response?.data?.error || error.message },
        }));
      setSaving(false);
      if (closeResponse.data?.error) {
        setMessage(closeResponse.data.error);
        return;
      }
      setMessage("Nu există modificări noi de trimis. Draftul a fost închis.");
      await loadDraft();
      await onRefresh?.();
      return;
    }

    setSaving(true);
    setMessage("");
    const response = await base44.functions
      .invoke("submitProviderWorkspaceChange", {
        action: "submit",
        submission_id: draft.id,
        location_id: selectedLocation.id,
        section: "location_details",
      })
      .catch((error) => ({
        data: { error: error.response?.data?.error || error.message },
      }));
    setSaving(false);
    const data = response.data || {};

    if (data.error) {
      setMessage(data.error);
      return;
    }
    if (data.no_changes) {
      setMessage(data.message || "Nu există modificări noi de trimis.");
    } else if (data.duplicate || data.already_pending) {
      setMessage(
        data.message || "Această modificare este deja în verificare.",
      );
    } else {
      setMessage("Modificările locației au fost trimise spre verificare.");
    }

    await loadDraft();
    await onRefresh?.();
  };

  if (locationCount === 0) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="font-heading text-[2rem] font-extrabold tracking-[-0.035em]">
            Locații
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Adaugă primul punct de lucru al organizației.
          </p>
        </header>
        <section className="border-y border-dashed border-foreground/20 py-10 text-center">
          <MapPin className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-bold">Nu există locații</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Fiecare locație va avea propriile servicii, program, specialiști și
            fotografii.
          </p>
          {canAddLocations && (
            <Link
              to="/adauga-sau-revendica"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
            >
              <Plus className="h-4 w-4" /> Adaugă locație
            </Link>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-foreground/15 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-[2rem] font-extrabold leading-tight tracking-[-0.035em]">
            Locațiile organizației
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Selectează un punct de lucru și gestionează separat datele publice,
            programul, serviciile, specialiștii și fotografiile.
          </p>
        </div>
        {canAddLocations && (
          <Link
            to="/adauga-sau-revendica"
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Adaugă locație
          </Link>
        )}
      </header>

      {hasMultipleLocations && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Puncte de lucru</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locationCount} {locationCount === 1 ? "locație" : "locații"} în această organizație
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {locations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                active={location.id === selectedLocation?.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      )}

      {previewLocation && (
        <>
          <section className="border-y border-foreground/15 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-2xl font-extrabold tracking-[-0.03em]">
                    {selectedLocationName}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedState.activityClassName}`}
                  >
                    {selectedState.activityLabel}
                  </span>
                  <span className="rounded-full border border-foreground/10 bg-secondary px-2.5 py-1 text-xs font-semibold">
                    {selectedState.controlLabel}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${locationDataState.className}`}
                  >
                    {locationDataState.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedLocation.locality_name || selectedLocation.city ||
                    "Localitate necompletată"}
                  {selectedLocation.county_name || selectedLocation.county
                    ? ` · ${selectedLocation.county_name || selectedLocation.county}`
                    : ""}
                </p>
              </div>

              {canManageLocationProfile && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-transparent px-5 text-sm font-semibold hover:bg-white/45 sm:w-auto"
                >
                  <Pencil className="h-4 w-4" /> Editează datele
                </button>
              )}
            </div>

            {draft && (
              <div className="mt-5 border-y border-[#c6d3da] bg-[#dce5e9] px-4 py-3 text-sm text-[#1c1c1c]">
                Datele de mai jos previzualizează modificările din draft. Profilul
                public rămâne neschimbat până la aprobare.
              </div>
            )}

            <div className="mt-5 grid divide-y divide-foreground/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
              <div className="sm:pr-5">
                <DetailLine
                  icon={MapPin}
                  label="Adresa"
                  value={formatStreetAddress(previewLocation.address, previewLocation.locality_name || previewLocation.city)}
                />
              </div>
              <div className="sm:px-5">
                <DetailLine
                  icon={Phone}
                  label="Telefon"
                  value={
                    previewLocation.public_phone || previewLocation.phone_public
                  }
                  href={
                    previewLocation.public_phone || previewLocation.phone_public
                      ? `tel:${previewLocation.public_phone || previewLocation.phone_public}`
                      : ""
                  }
                />
              </div>
              <div className="sm:col-span-2 sm:border-t sm:border-foreground/10 sm:pl-0 lg:col-span-1 lg:border-t-0 lg:pl-5">
                <DetailLine
                  icon={Mail}
                  label="Email public"
                  value={previewLocation.public_email}
                  href={
                    previewLocation.public_email
                      ? `mailto:${previewLocation.public_email}`
                      : ""
                  }
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPublicMap((current) => !current)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/20 px-4 text-sm font-semibold hover:bg-white/45"
              >
                <MapPin className="h-4 w-4" />
                {showPublicMap ? "Ascunde harta" : "Vezi pe hartă"}
              </button>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold underline underline-offset-4"
                >
                  Traseu
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <span className={`text-xs font-semibold ${hasExactPin ? "text-green-700" : "text-muted-foreground"}`}>
                {hasExactPin && draft ? "Poziție confirmată în draft" : pinLabel}
              </span>
            </div>

            {showPublicMap && (
              <div className="mt-5 overflow-hidden rounded-[16px] border border-foreground/15 bg-secondary/35">
                <div className="h-64 sm:h-72">
                  <LocationPinMap key={selectedLocation.id} location={previewLocation} />
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Configurează locația</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Module separate pentru {selectedLocationName}.
                </p>
              </div>
            </div>
            <div
              className={`grid gap-3 ${
                visibleModuleCount >= 3
                  ? "md:grid-cols-3"
                  : visibleModuleCount === 2
                    ? "md:grid-cols-2"
                    : "grid-cols-1"
              }`}
            >
              {canManageLocationContent && (
                <ConfigureCard
                  icon={Wrench}
                  tone={CONFIGURE_TONES.servicii}
                  title="Servicii"
                  text="Alege serviciile disponibile în această locație."
                  onClick={() =>
                    onOpenModule?.("servicii", selectedLocation.id)
                  }
                />
              )}
              {canManageOperationalStatus && (
                <ConfigureCard
                  icon={Clock}
                  tone={CONFIGURE_TONES.program}
                  title="Program"
                  text="Setează programul acestui punct de lucru."
                  onClick={() => onOpenModule?.("program", selectedLocation.id)}
                />
              )}
              {canManageSpecialists && (
                <ConfigureCard
                  icon={Users}
                  tone={CONFIGURE_TONES.specialisti}
                  title="Specialiști"
                  text="Specialiștii afișați, invitațiile și cererile „Lucrez aici”."
                  onClick={() =>
                    onOpenModule?.("specialisti", selectedLocation.id)
                  }
                />
              )}
            </div>
          </section>
        </>
      )}

      {editOpen && canManageLocationProfile && selectedLocation && (
        <div
          className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditOpen(false);
          }}
        >
          <aside
            className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-border bg-background shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Editează datele locației"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground">
                  {selectedLocationName}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-2xl font-extrabold tracking-tight">
                    Editează datele locației
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${locationDataState.className}`}
                  >
                    {locationDataState.label}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Numele public, adresa, contactul și poziția pe hartă sunt
                  publicate numai după verificarea VIASEE.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary"
                aria-label="Închide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-5">
                {pendingReview && (
                  <div className="rounded-2xl border border-[#c6d3da] bg-[#dce5e9] px-4 py-3 text-sm leading-relaxed text-[#1c1c1c]">
                    Datele sunt deja în verificare. Poți consulta previzualizarea,
                    dar nu le poți modifica până la decizia VIASEE.
                  </div>
                )}

                <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-bold">Identitatea locației</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Numele public și adresa principală a punctului de lucru.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="location-display-name" className="text-sm font-semibold text-foreground">
                        Nume public locație
                      </label>
                      <input
                        className={`${inputCls} mt-1.5`}
                        id="location-display-name"
                        value={values.public_display_name}
                        disabled={pendingReview}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            public_display_name: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="location-address" className="text-sm font-semibold text-foreground">
                        Adresa pentru hartă
                      </label>
                      <input
                        className={`${inputCls} mt-1.5`}
                        id="location-address"
                        value={values.address}
                        disabled={pendingReview}
                        onChange={(event) =>
                          setValues({ ...values, address: event.target.value, map_precision: "approximate" })
                        }
                        placeholder="Strada, număr, localitate"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold">Poziție pe hartă</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Apasă pe hartă sau trage pinul la intrarea locației.
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${hasExactPin ? "bg-[#dfe3d2] text-[#1c1c1c]" : "bg-secondary text-muted-foreground"}`}>
                      {hasExactPin ? "Confirmată în formular" : pinLabel}
                    </span>
                  </div>
                  <div className="mt-4 h-72 overflow-hidden rounded-2xl border border-border sm:h-80">
                    <LocationPinMap location={previewLocation} onPositionChange={pendingReview ? undefined : editPosition} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                      Verifică dacă pinul corespunde adresei. Poziția aprobată va apărea în Caută, rezultate și profil.
                    </p>
                    <button
                      type="button"
                      disabled={pendingReview || !hasValidPin || hasCoordinateIssues || !values.address.trim() || hasExactPin}
                      onClick={() => setValues((current) => ({ ...current, map_precision: "exact" }))}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {hasExactPin ? "Poziție confirmată" : "Confirmă poziția"}
                    </button>
                  </div>
                  {hasExactPin && !pendingReview && <p className="mt-2 text-xs text-muted-foreground">Salvează draftul și trimite-l spre verificare pentru a publica poziția confirmată.</p>}
                  {hasCoordinateIssues && (
                    <p role="alert" className="mt-3 rounded-xl bg-[#efd5c5] px-3 py-2 text-xs leading-relaxed">
                      {coordinateValidation.issues[0]}
                    </p>
                  )}
                  <button
                    type="button"
                    aria-expanded={showAdvancedMap}
                    onClick={() => setShowAdvancedMap((current) => !current)}
                    className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-bold underline underline-offset-4"
                  >
                    Coordonate și opțiuni avansate
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedMap ? "rotate-180" : ""}`} />
                  </button>
                  {showAdvancedMap && (
                    <div className="mt-2 space-y-3 rounded-2xl border border-border bg-secondary/30 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="location-lat" className="text-xs font-semibold text-muted-foreground">Latitudine</label>
                          <input id="location-lat" className={`${inputCls} mt-1.5`} value={values.lat} disabled={pendingReview} inputMode="decimal"
                            onChange={(event) => setValues({ ...values, lat: cleanNumber(event.target.value), map_precision: "approximate" })} placeholder="45.793140" />
                        </div>
                        <div>
                          <label htmlFor="location-lng" className="text-xs font-semibold text-muted-foreground">Longitudine</label>
                          <input id="location-lng" className={`${inputCls} mt-1.5`} value={values.lng} disabled={pendingReview} inputMode="decimal"
                            onChange={(event) => setValues({ ...values, lng: cleanNumber(event.target.value), map_precision: "approximate" })} placeholder="24.151920" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="location-place-id" className="text-xs font-semibold text-muted-foreground">Google Place ID, opțional</label>
                        <input id="location-place-id" className={`${inputCls} mt-1.5`} value={values.place_id} disabled={pendingReview}
                          onChange={(event) => setValues({ ...values, place_id: event.target.value })} />
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-bold">Contact public</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Datele prin care clienții pot contacta direct această locație.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-foreground">
                        Telefon public locație
                      </label>
                      <input
                        className={`${inputCls} mt-1.5`}
                        value={values.public_phone}
                        disabled={pendingReview}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            public_phone: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground">
                        Email public locație
                      </label>
                      <input
                        className={`${inputCls} mt-1.5`}
                        value={values.public_email}
                        disabled={pendingReview}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            public_email: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </section>

                <div className="rounded-2xl border border-[#dac69b] bg-[#eadcba] px-4 py-3 text-sm leading-relaxed text-[#1c1c1c]">
                  Schimbările nu se publică direct. După trimitere, apar în panoul
                  de administrare pentru verificare.
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-card px-5 py-4 sm:px-6">
              {message && (
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                  {message}
                </p>
              )}
              {draftState?.editable && hasUnsavedChanges && <p className="mb-3 text-xs text-muted-foreground">Salvează modificările în draft înainte de trimitere.</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
                >
                  Închide
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving || pendingReview}
                    onClick={saveDraft}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> Salvează draft
                  </button>
                  {draftState?.editable && (
                    <button
                      type="button"
                      disabled={saving || hasCoordinateIssues || hasUnsavedChanges}
                      onClick={submitDraft}
                      className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      Trimite spre verificare
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
