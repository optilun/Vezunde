import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Info,
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
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl, hasMapLocation } from "@/lib/maps";
import { deriveProviderLocationState, deriveSubmissionState } from "@/lib/providerWorkspaceState";
import { hasPublishedSectionChanges } from "../../../../shared/providerWorkspaceSubmissionComparison.js";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/50 disabled:cursor-not-allowed disabled:opacity-60";

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
  if ((rawLat && !rawLng) || (!rawLat && rawLng)) issues.push("Completeaza si latitudinea, si longitudinea pentru a folosi pinul exact.");
  if (rawLat && lat === "") issues.push("Latitudinea trebuie sa fie un numar valid.");
  if (rawLng && lng === "") issues.push("Longitudinea trebuie sa fie un numar valid.");
  if (lat !== "" && (lat < -90 || lat > 90)) issues.push("Latitudinea trebuie sa fie intre -90 si 90.");
  if (lng !== "" && (lng < -180 || lng > 180)) issues.push("Longitudinea trebuie sa fie intre -180 si 180.");
  return { issues, lat, lng };
}

function deriveLocationDataStatus(activeSubmission, latestSubmission, locationState, location) {
  const activeState = deriveSubmissionState(activeSubmission);
  if (activeState) return activeState;

  if (latestSubmission?.status === "approved") {
    return {
      label: "Date publice aprobate",
      className: "border border-green-200 bg-green-50 text-green-800",
      editable: false,
      pendingReview: false,
    };
  }

  if (latestSubmission?.status === "rejected") {
    return {
      label: "Ultima modificare respinsa",
      className: "border border-red-200 bg-red-50 text-red-800",
      editable: false,
      pendingReview: false,
    };
  }

  if (locationState.published) {
    return {
      label: "Date publice publicate",
      className: "border border-green-200 bg-green-50 text-green-800",
      editable: false,
      pendingReview: false,
    };
  }

  const hasIdentity = !!String(location?.public_display_name || location?.name || "").trim();
  const hasAddress = !!String(location?.address || "").trim();
  const hasContact = !!String(location?.public_phone || location?.phone_public || location?.public_email || "").trim();
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
    className: "border border-amber-200 bg-amber-50 text-amber-800",
    editable: false,
    pendingReview: false,
  };
}

function LocationRow({ location, active, onSelect }) {
  const state = deriveProviderLocationState(location);
  const completeness = Number.isFinite(Number(location.profile_completeness)) ? Number(location.profile_completeness) : 0;
  return (
    <button type="button" onClick={() => onSelect(location.id)} className={`w-full rounded-2xl border bg-card p-3.5 text-left transition-all hover:shadow-sm ${active ? "border-foreground shadow-sm" : "border-border hover:border-foreground/30"}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><MapPin className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-bold">{location.public_display_name || location.name}</div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${state.activityClassName}`}>{state.activityLabel}</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{location.locality_name || location.city || "Localitate lipsa"}</p>
          {location.address && <p className="mt-1 truncate text-xs text-muted-foreground">{location.address}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Completitudine <b className="text-foreground">{completeness}%</b></span>
        {active && <CheckCircle2 className="h-4 w-4 text-green-700" aria-label="Locatie selectata" />}
      </div>
    </button>
  );
}

function DetailItem({ icon: Icon, label, value, className = "", valueClassName = "" }) {
  return (
    <div className={`rounded-2xl border border-border bg-secondary/45 px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`mt-1 break-words text-sm font-bold leading-snug ${valueClassName}`}>{value || "Lipseste"}</div>
    </div>
  );
}

function InfoHint({ children }) {
  return (
    <details className="relative inline-block">
      <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"><Info className="h-3.5 w-3.5" /></summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-lg">{children}</div>
    </details>
  );
}

function ConfigureCard({ icon: Icon, title, text, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Icon className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold">{title}</div><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
          <div className="mt-3 text-xs font-bold underline underline-offset-4">Configureaza</div>
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
  };
}

export default function ProviderLocations({ workspace, selectedLocationId, onSelect, onRefresh, onOpenModule }) {
  const locations = workspace.locations || [];
  const locationById = Object.fromEntries(locations.map((location) => [location.id, location]));
  const selectedLocation = locationById[selectedLocationId] || locations[0] || null;
  const [draft, setDraft] = useState(null);
  const [latestLocationSubmission, setLatestLocationSubmission] = useState(null);
  const [values, setValues] = useState(defaultValues(selectedLocation));
  const [showAdvancedMap, setShowAdvancedMap] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const coordinateValidation = useMemo(() => getCoordinateValidation(values), [values]);
  const draftState = deriveSubmissionState(draft);
  const pendingReview = draftState?.pendingReview === true;
  const hasCoordinateIssues = coordinateValidation.issues.length > 0;

  const previewLocation = useMemo(() => {
    if (!selectedLocation) return null;
    const lat = numericOrEmpty(values.lat);
    const lng = numericOrEmpty(values.lng);
    return {
      ...selectedLocation,
      public_display_name: values.public_display_name || selectedLocation.public_display_name || selectedLocation.name,
      name: values.public_display_name || selectedLocation.name,
      address: values.address,
      public_phone: values.public_phone,
      phone_public: values.public_phone,
      public_email: values.public_email,
      lat: lat !== "" ? lat : null,
      lng: lng !== "" ? lng : null,
      place_id: values.place_id || "",
    };
  }, [selectedLocation, values]);

  const mapUrl = previewLocation ? buildGoogleMapsUrl(previewLocation) : "";
  const embedUrl = previewLocation ? buildGoogleMapsEmbedUrl(previewLocation) : "";
  const hasExactPin = previewLocation?.lat !== null
    && previewLocation?.lat !== undefined
    && previewLocation?.lat !== ""
    && previewLocation?.lng !== null
    && previewLocation?.lng !== undefined
    && previewLocation?.lng !== ""
    && Number.isFinite(Number(previewLocation.lat))
    && Number.isFinite(Number(previewLocation.lng));
  const locationCount = locations.length;
  const hasMultipleLocations = locationCount > 1;
  const selectedLocationName = previewLocation?.public_display_name || previewLocation?.name || "Locatie";
  const selectedState = deriveProviderLocationState(selectedLocation || {});
  const locationDataState = deriveLocationDataStatus(draft, latestLocationSubmission, selectedState, selectedLocation);

  const loadDraft = async () => {
    if (!selectedLocation?.id) return;
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: selectedLocation.id }).catch(() => ({ data: { submissions: [] } }));
    const locationSubmissions = (response.data?.submissions || []).filter((submission) => submission.section === "location_details");
    const own = locationSubmissions.find((submission) => ["draft", "needs_more_info", "pending_review"].includes(submission.status));
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
    loadDraft();
    setMessage("");
    setShowAdvancedMap(false);
    setEditOpen(false);
  }, [selectedLocation?.id]);

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
    if (hasCoordinateIssues) { setMessage(coordinateValidation.issues[0]); return; }
    setSaving(true);
    setMessage("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
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
    };
    if (!hasPublishedSectionChanges("location_details", payload, selectedLocation)) {
      setSaving(false);
      setMessage("Nu exista modificari noi de salvat.");
      return;
    }
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: draft?.id, location_id: selectedLocation.id, section: "location_details", payload }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu exista modificari noi de salvat.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Aceasta modificare este deja in verificare.");
    else if (data.resumed || data.unchanged) setMessage(data.message || "Draftul existent a fost incarcat.");
    else setMessage("Draft salvat. Trimite-l spre review cand este pregatit.");
    await loadDraft();
    await onRefresh?.();
  };

  const submitDraft = async () => {
    if (!draft || !selectedLocation?.id) return;
    if (hasCoordinateIssues) { setMessage(coordinateValidation.issues[0]); return; }
    let draftPayload = {};
    try { draftPayload = JSON.parse(draft.payload_json || "{}"); } catch (_error) { draftPayload = {}; }
    if (!hasPublishedSectionChanges("location_details", draftPayload, selectedLocation)) {
      setSaving(true);
      setMessage("");
      const closeResponse = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "withdraw", submission_id: draft.id, location_id: selectedLocation.id, section: "location_details" }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
      setSaving(false);
      if (closeResponse.data?.error) { setMessage(closeResponse.data.error); return; }
      setMessage("Nu exista modificari noi de trimis. Draftul a fost inchis.");
      await loadDraft();
      await onRefresh?.();
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: selectedLocation.id, section: "location_details" }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu exista modificari noi de trimis.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Aceasta modificare este deja in verificare.");
    else setMessage("Modificarile locatiei au fost trimise spre review.");
    await loadDraft();
    await onRefresh?.();
  };

  if (locationCount === 0) {
    return (
      <div className="space-y-5">
        <div><h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii</h1><p className="mt-1 text-xs text-muted-foreground">Adauga primul punct de lucru al organizatiei.</p></div>
        <section className="rounded-[24px] border border-dashed border-border bg-card p-8 text-center shadow-sm">
          <MapPin className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-bold">Nu exista locatii</h2>
          <p className="mt-1 text-xs text-muted-foreground">Dupa aprobare, fiecare locatie va avea propriile servicii, program, specialisti si fotografii.</p>
          <Link to="/adauga-sau-revendica" className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"><Plus className="h-4 w-4" /> Adauga locatie</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Gestioneaza fiecare punct de lucru. Serviciile, programul, specialistii, fotografiile si datele publice sunt separate pe locatie.</p>
        </div>
        <Link to="/adauga-sau-revendica" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"><Plus className="h-4 w-4" /> Adauga locatie</Link>
      </div>

      <div className={`grid gap-6 ${hasMultipleLocations ? "xl:grid-cols-[330px_minmax(0,1fr)] xl:items-start" : "grid-cols-1"}`}>
        {hasMultipleLocations && (
          <aside className="xl:sticky xl:top-6">
            <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-bold">Puncte de lucru</div><p className="mt-1 text-xs text-muted-foreground">{locationCount} locatii</p></div>
                <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">Multi-locatie</span>
              </div>
              <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {locations.map((location) => <LocationRow key={location.id} location={location} active={location.id === selectedLocation?.id} onSelect={onSelect} />)}
              </div>
            </div>
          </aside>
        )}

        <div className="space-y-5">
          {previewLocation && (
            <>
              <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
                <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.25fr)]">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-heading text-xl font-extrabold tracking-tight">{selectedLocationName}</h2>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${selectedState.activityClassName}`}>{selectedState.activityLabel}</span>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{selectedState.controlLabel}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{selectedLocation.locality_name || selectedLocation.city}{selectedLocation.county_name || selectedLocation.county ? ` - ${selectedLocation.county_name || selectedLocation.county}` : ""}</span>
                          <InfoHint>Tot ce configurezi aici se aplica doar acestei locatii.</InfoHint>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${locationDataState.className}`}>
                          {locationDataState.label}
                        </span>
                        <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-secondary">
                          <Pencil className="h-3.5 w-3.5" /> Editeaza datele
                        </button>
                      </div>
                    </div>

                    {draft && <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">Datele de mai jos sunt previzualizarea modificarilor din draft. Profilul public ramane neschimbat pana la aprobare.</div>}

                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_minmax(150px,0.8fr)]">
                      <DetailItem icon={MapPin} label="Adresa" value={previewLocation.address} />
                      <DetailItem icon={Phone} label="Telefon" value={previewLocation.public_phone || previewLocation.phone_public} />
                      <DetailItem className="sm:col-span-2" valueClassName="text-base" icon={Mail} label="Email public" value={previewLocation.public_email} />
                    </div>
                  </div>

                  <div className="border-t border-border bg-secondary/30 p-5 lg:border-l lg:border-t-0 lg:p-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">Harta si adresa {hasExactPin && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-200">pin exact</span>}<InfoHint>Harta foloseste coordonatele daca exista. In lipsa lor foloseste adresa.</InfoHint></div>
                        <p className="mt-2 line-clamp-2 max-w-md text-xs leading-relaxed text-muted-foreground">{previewLocation.address || "Adresa nepublicata"}</p>
                      </div>
                      {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-background">Deschide in Google Maps <ExternalLink className="h-3.5 w-3.5" /></a>}
                    </div>
                    <div className="h-72 overflow-hidden rounded-[22px] border border-border bg-secondary lg:h-[300px]">
                      {hasMapLocation(previewLocation) && embedUrl ? <iframe title={`Harta ${selectedLocationName}`} src={embedUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="flex h-full flex-col items-center justify-center text-center"><MapPin className="h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Harta nu poate fi afisata</p><p className="mt-1 text-xs text-muted-foreground">Completeaza adresa sau coordonatele locatiei.</p></div>}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div><div className="text-sm font-bold">Configureaza locatia</div><p className="mt-1 text-xs text-muted-foreground">Module separate pentru acest punct de lucru.</p></div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{selectedLocationName}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <ConfigureCard icon={Wrench} title="Servicii" text="Alege serviciile disponibile in aceasta locatie." onClick={() => onOpenModule?.("servicii", selectedLocation.id)} />
                  <ConfigureCard icon={Clock} title="Program" text="Seteaza programul acestei locatii." onClick={() => onOpenModule?.("program", selectedLocation.id)} />
                  <ConfigureCard icon={Users} title="Specialisti" text="Invita specialistii asociati acestei locatii." onClick={() => onOpenModule?.("specialisti", selectedLocation.id)} />
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {editOpen && selectedLocation && (
        <div className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}>
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="Editeaza datele locatiei">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">{selectedLocationName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-xl font-extrabold tracking-tight">Editeaza datele locatiei</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${locationDataState.className}`}>
                    {locationDataState.label}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Numele public, adresa, contactul si pozitia pe harta sunt publicate numai dupa verificarea Vezunde.</p>
              </div>
              <button type="button" onClick={() => setEditOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary" aria-label="Inchide"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-5">
                {pendingReview && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900">Datele sunt deja in verificare. Poti consulta previzualizarea, dar nu le poti modifica pana la decizia Vezunde.</div>}

                <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold">Identitatea locatiei</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Numele public si adresa principala a punctului de lucru.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><label className="text-xs font-semibold text-muted-foreground">Nume public locatie</label><input className={`${inputCls} mt-1.5`} value={values.public_display_name} disabled={pendingReview} onChange={(event) => setValues({ ...values, public_display_name: event.target.value })} /></div>
                    <div><label className="text-xs font-semibold text-muted-foreground">Adresa pentru harta</label><input className={`${inputCls} mt-1.5`} value={values.address} disabled={pendingReview} onChange={(event) => setValues({ ...values, address: event.target.value })} placeholder="Strada, numar, localitate" /></div>
                  </div>
                </section>

                <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="text-sm font-bold">Pozitie pe harta</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Coordonatele sunt optionale, dar ofera un pin mai precis.</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${hasExactPin ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"}`}>{hasExactPin ? "Pin exact activ" : "Optional"}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div><label className="text-xs font-semibold text-muted-foreground">Latitudine</label><input className={`${inputCls} mt-1.5`} value={values.lat} disabled={pendingReview} onChange={(event) => setValues({ ...values, lat: cleanNumber(event.target.value) })} placeholder="45.793140" /></div>
                    <div><label className="text-xs font-semibold text-muted-foreground">Longitudine</label><input className={`${inputCls} mt-1.5`} value={values.lng} disabled={pendingReview} onChange={(event) => setValues({ ...values, lng: cleanNumber(event.target.value) })} placeholder="24.151920" /></div>
                  </div>
                  {hasCoordinateIssues && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">{coordinateValidation.issues[0]}</div>}
                  <button type="button" onClick={() => setShowAdvancedMap((current) => !current)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-4">Optiuni avansate <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedMap ? "rotate-180" : ""}`} /></button>
                  {showAdvancedMap && <div className="mt-3 rounded-2xl border border-border bg-secondary/30 p-3"><label className="text-xs font-semibold text-muted-foreground">Google Place ID, optional</label><input className={`${inputCls} mt-1.5`} value={values.place_id} disabled={pendingReview} onChange={(event) => setValues({ ...values, place_id: event.target.value })} placeholder="optional" /></div>}
                </section>

                <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
                  <div className="mb-4"><h3 className="text-sm font-bold">Contact public</h3><p className="mt-1 text-xs text-muted-foreground">Datele prin care clientii pot contacta direct aceasta locatie.</p></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><label className="text-xs font-semibold text-muted-foreground">Telefon public locatie</label><input className={`${inputCls} mt-1.5`} value={values.public_phone} disabled={pendingReview} onChange={(event) => setValues({ ...values, public_phone: event.target.value })} /></div>
                    <div><label className="text-xs font-semibold text-muted-foreground">Email public locatie</label><input className={`${inputCls} mt-1.5`} value={values.public_email} disabled={pendingReview} onChange={(event) => setValues({ ...values, public_email: event.target.value })} /></div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-[22px] border border-border bg-card">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                    <div><h3 className="text-sm font-bold">Previzualizare harta</h3><p className="mt-1 text-xs text-muted-foreground">Se actualizeaza pe baza datelor introduse.</p></div>
                    {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Google Maps <ExternalLink className="h-3.5 w-3.5" /></a>}
                  </div>
                  <div className="h-64 bg-secondary/30">
                    {hasMapLocation(previewLocation) && embedUrl ? <iframe title={`Previzualizare harta ${selectedLocationName}`} src={embedUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><MapPin className="h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Completeaza adresa sau coordonatele</p><p className="mt-1 text-xs text-muted-foreground">Previzualizarea va aparea aici.</p></div>}
                  </div>
                </section>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Schimbarile nu se publica direct. Dupa trimitere, apar in panoul de administrare pentru verificare.</div>
              </div>
            </div>

            <div className="border-t border-border bg-card px-5 py-4 sm:px-6">
              {message && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{message}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setEditOpen(false)} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Inchide</button>
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={saving || pendingReview} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salveaza draft</button>
                  {draftState?.editable && <button disabled={saving || hasCoordinateIssues} onClick={submitDraft} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">Trimite spre review</button>}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
