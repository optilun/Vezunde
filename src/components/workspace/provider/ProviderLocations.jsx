import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, ChevronDown, Clock, ExternalLink, Info, Mail, MapPin, Phone, Plus, Save, Users, Wrench, X } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PROFILE_CONTROL_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl, hasMapLocation } from "@/lib/maps";
import ProviderServices from "./ProviderServices";
import ProviderHours from "./ProviderHours";
import ProviderTeam from "./ProviderTeam";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-foreground/50 transition-colors";

function cleanNumber(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : raw;
}

function numericOrEmpty(value) {
  const raw = cleanNumber(value);
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
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

function LocationRow({ loc, membership, active, onSelect }) {
  const statusLabel = PROFILE_CONTROL_LABELS[loc.profile_control_status] || loc.profile_control_status || "-";
  const activeStatus = loc.active_status === "inactiva" ? "Inactiva" : "Activa";
  return (
    <button
      type="button"
      onClick={() => onSelect(loc.id)}
      className={`w-full rounded-2xl border bg-card p-3.5 text-left transition-all hover:shadow-sm ${active ? "border-foreground shadow-sm" : "border-border hover:border-foreground/30"}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-bold">{loc.public_display_name || loc.name}</div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${activeStatus === "Activa" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{activeStatus}</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{loc.locality_name || loc.city || "Localitate lipsa"} · {statusLabel}</p>
          {loc.address && <p className="mt-1 truncate text-xs text-muted-foreground">{loc.address}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Completitudine <b className="text-foreground">{membership?.profile_completeness ?? 0}%</b></span>
        <span className="font-semibold text-foreground">{active ? "Selectata" : "Selecteaza"}</span>
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
      <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-lg">
        {children}
      </div>
    </details>
  );
}

function ConfigureCard({ icon: Icon, title, text, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Icon className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">{title}</div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
          <div className="mt-3 text-xs font-bold underline underline-offset-4">Configureaza</div>
        </div>
      </div>
    </button>
  );
}

function LocationConfigModal({ open, title, locationName, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground">{locationName}</div>
            <h2 className="font-heading text-xl font-extrabold tracking-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary" aria-label="Inchide">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function ProviderLocations({ workspace, selectedLocationId, onSelect, overview, onRefresh }) {
  const locById = Object.fromEntries((workspace.locations || []).map((l) => [l.id, l]));
  const membershipByLocation = Object.fromEntries((workspace.memberships || []).map((m) => [m.location_id, m]));
  const selectedLocation = locById[selectedLocationId] || (workspace.locations || [])[0] || null;
  const selectedMembership = selectedLocation ? membershipByLocation[selectedLocation.id] : null;
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({ public_display_name: "", address: "", public_phone: "", public_email: "", lat: "", lng: "", place_id: "" });
  const [showAdvancedMap, setShowAdvancedMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeModal, setActiveModal] = useState(null);

  const coordinateValidation = useMemo(() => getCoordinateValidation(values), [values]);

  const previewLocation = useMemo(() => {
    if (!selectedLocation) return null;
    const lat = numericOrEmpty(values.lat);
    const lng = numericOrEmpty(values.lng);
    return {
      ...selectedLocation,
      public_display_name: values.public_display_name || selectedLocation.public_display_name || selectedLocation.name,
      name: values.public_display_name || selectedLocation.name,
      address: values.address || selectedLocation.address,
      public_phone: values.public_phone || selectedLocation.public_phone,
      phone_public: values.public_phone || selectedLocation.phone_public,
      public_email: values.public_email || selectedLocation.public_email,
      lat: lat !== "" ? lat : selectedLocation.lat,
      lng: lng !== "" ? lng : selectedLocation.lng,
      place_id: values.place_id || selectedLocation.place_id,
    };
  }, [selectedLocation, values]);

  const mapUrl = previewLocation ? buildGoogleMapsUrl(previewLocation) : "";
  const embedUrl = previewLocation ? buildGoogleMapsEmbedUrl(previewLocation) : "";
  const hasExactPin = Number.isFinite(Number(previewLocation?.lat)) && Number.isFinite(Number(previewLocation?.lng));
  const hasCoordinateIssues = coordinateValidation.issues.length > 0;

  const loadDraft = async () => {
    if (!selectedLocation?.id) return;
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: selectedLocation.id }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "location_details" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    setDraft(own || null);
    if (own) {
      const payload = JSON.parse(own.payload_json || "{}");
      setValues({
        public_display_name: payload.public_display_name ?? (selectedLocation.public_display_name || selectedLocation.name || ""),
        address: payload.address ?? (selectedLocation.address || ""),
        public_phone: payload.public_phone ?? (selectedLocation.public_phone || selectedLocation.phone_public || ""),
        public_email: payload.public_email ?? (selectedLocation.public_email || ""),
        lat: payload.lat ?? (selectedLocation.lat ?? ""),
        lng: payload.lng ?? (selectedLocation.lng ?? ""),
        place_id: payload.place_id ?? (selectedLocation.place_id || ""),
      });
    } else {
      setValues({
        public_display_name: selectedLocation.public_display_name || selectedLocation.name || "",
        address: selectedLocation.address || "",
        public_phone: selectedLocation.public_phone || selectedLocation.phone_public || "",
        public_email: selectedLocation.public_email || "",
        lat: selectedLocation.lat ?? "",
        lng: selectedLocation.lng ?? "",
        place_id: selectedLocation.place_id || "",
      });
    }
  };

  useEffect(() => { loadDraft(); setMsg(""); setActiveModal(null); setShowAdvancedMap(false); }, [selectedLocation?.id]);

  const saveDraft = async () => {
    if (!selectedLocation?.id) return;
    if (hasCoordinateIssues) { setMsg(coordinateValidation.issues[0]); return; }
    setSaving(true); setMsg("");
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
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: draft?.id, location_id: selectedLocation.id, section: "location_details", payload }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat. Trimite-l spre review cand este pregatit.");
    loadDraft();
    onRefresh && onRefresh();
  };

  const submitDraft = async () => {
    if (!draft || !selectedLocation?.id) return;
    if (hasCoordinateIssues) { setMsg(coordinateValidation.issues[0]); return; }
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: selectedLocation.id, section: "location_details" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Modificarea locatiei a fost trimisa spre review.");
    loadDraft();
    onRefresh && onRefresh();
  };

  const locationCount = workspace.locations?.length || 0;
  const hasMultipleLocations = locationCount > 1;
  const pendingReview = draft?.status === "pending_review";
  const hasDraftChanges = !!draft;
  const selectedLocationName = selectedLocation?.public_display_name || selectedLocation?.name || "Locatie";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Gestioneaza fiecare punct de lucru. Serviciile, programul, echipa si datele publice se configureaza pe locatie.
          </p>
        </div>
        <Link to="/adauga-sau-revendica" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
          <Plus className="h-4 w-4" /> Adauga locatie
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Puncte de lucru</div>
                <p className="mt-1 text-xs text-muted-foreground">{locationCount} {locationCount === 1 ? "locatie" : "locatii"}</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{hasMultipleLocations ? "Multi-locatie" : "O locatie"}</span>
            </div>
            <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {(workspace.locations || []).map((loc) => (
                <LocationRow key={loc.id} loc={loc} membership={membershipByLocation[loc.id]} active={loc.id === selectedLocation?.id} onSelect={onSelect} />
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-dashed border-border bg-secondary/35 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card"><Building2 className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-bold">Locatie noua</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Dupa aprobare, noua locatie apare aici cu propriile servicii, program si echipa.</p>
                <Link to="/adauga-sau-revendica" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-4">
                  Cere adaugarea unei locatii <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          {selectedLocation && previewLocation && (
            <>
              <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
                <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.25fr)]">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-heading text-xl font-extrabold tracking-tight">{selectedLocationName}</h2>
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-200">{PROFILE_CONTROL_LABELS[selectedLocation.profile_control_status] || selectedLocation.profile_control_status}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{selectedLocation.locality_name || selectedLocation.city}{selectedLocation.county_name ? ` · ${selectedLocation.county_name}` : ""}</span>
                          <InfoHint>Tot ce configurezi aici se aplica doar acestei locatii: servicii, program, specialisti si modificarile de adresa/contact.</InfoHint>
                        </div>
                      </div>
                      {hasDraftChanges && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Draft in lucru</span>}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DetailItem icon={MapPin} label="Adresa" value={selectedLocation.address} />
                      <DetailItem icon={Phone} label="Telefon" value={selectedLocation.public_phone || selectedLocation.phone_public} />
                      <DetailItem className="sm:col-span-2" valueClassName="text-base" icon={Mail} label="Email public" value={selectedLocation.public_email} />
                    </div>
                  </div>

                  <div className="border-t border-border bg-secondary/30 p-5 lg:border-l lg:border-t-0 lg:p-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                          Harta si adresa
                          {hasExactPin && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-200">pin exact</span>}
                          <InfoHint>Harta foloseste coordonatele daca exista. Daca nu exista coordonate, foloseste adresa publicata a locatiei.</InfoHint>
                        </div>
                        <p className="mt-2 line-clamp-2 max-w-md text-xs leading-relaxed text-muted-foreground">{previewLocation.address || "Adresa nepublicata"}</p>
                      </div>
                      {mapUrl && (
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-background">
                          Deschide in Maps <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="h-80 overflow-hidden rounded-[22px] border border-border bg-secondary lg:h-[340px]">
                      {hasMapLocation(previewLocation) && embedUrl ? (
                        <iframe title={`Harta ${previewLocation.public_display_name || previewLocation.name}`} src={embedUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                          <MapPin className="h-7 w-7 text-muted-foreground" />
                          <p className="mt-2 text-sm font-medium">Harta nu poate fi afisata inca</p>
                          <p className="mt-1 text-xs text-muted-foreground">Completeaza adresa sau coordonatele locatiei pentru preview.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">Configureaza locatia</div>
                    <p className="mt-1 text-xs text-muted-foreground">Aceste module sunt separate pentru fiecare punct de lucru.</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{selectedLocationName}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <ConfigureCard icon={Wrench} title="Servicii" text="Alege serviciile disponibile in aceasta locatie." onClick={() => setActiveModal("services")} />
                  <ConfigureCard icon={Clock} title="Program" text="Seteaza programul acestei locatii." onClick={() => setActiveModal("hours")} />
                  <ConfigureCard icon={Users} title="Specialisti" text="Invita specialistii care apar public pe aceasta locatie." onClick={() => setActiveModal("team")} />
                </div>
              </section>

              <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold">Modificari locatie</div>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">Necesita review</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Editeaza datele locatiei si verifica pinul pe harta inainte sa trimiti spre aprobare.</p>
                  </div>
                  {draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Nume public locatie</label>
                    <input className={`${inputCls} mt-1.5`} value={values.public_display_name} disabled={pendingReview} onChange={(e) => setValues({ ...values, public_display_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Adresa pentru harta</label>
                    <div className="mt-1.5 flex gap-2">
                      <input className={inputCls} value={values.address} disabled={pendingReview} onChange={(e) => setValues({ ...values, address: e.target.value })} placeholder="Strada, numar, localitate" />
                      {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold hover:bg-secondary"><ExternalLink className="h-3.5 w-3.5" /> Maps</a>}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Harta foloseste coordonatele daca exista. Fara coordonate, foloseste adresa.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Telefon public locatie</label>
                    <input className={`${inputCls} mt-1.5`} value={values.public_phone} disabled={pendingReview} onChange={(e) => setValues({ ...values, public_phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Email public locatie</label>
                    <input className={`${inputCls} mt-1.5`} value={values.public_email} disabled={pendingReview} onChange={(e) => setValues({ ...values, public_email: e.target.value })} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-secondary/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold">Pin exact pe harta</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Optional. Pentru precizie, copiaza coordonatele din Google Maps.</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${hasExactPin ? "bg-green-100 text-green-800" : "bg-background text-muted-foreground"}`}>{hasExactPin ? "Pin exact activ" : "Optional"}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Latitudine</label>
                      <input className={`${inputCls} mt-1.5`} value={values.lat} disabled={pendingReview} onChange={(e) => setValues({ ...values, lat: cleanNumber(e.target.value) })} placeholder="45.793140" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Longitudine</label>
                      <input className={`${inputCls} mt-1.5`} value={values.lng} disabled={pendingReview} onChange={(e) => setValues({ ...values, lng: cleanNumber(e.target.value) })} placeholder="24.151920" />
                    </div>
                  </div>
                  {hasCoordinateIssues && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">{coordinateValidation.issues[0]}</div>}
                  <button type="button" onClick={() => setShowAdvancedMap((v) => !v)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-4">
                    Optiuni avansate <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedMap ? "rotate-180" : ""}`} />
                  </button>
                  {showAdvancedMap && (
                    <div className="mt-3 rounded-2xl border border-border bg-card p-3">
                      <label className="text-xs font-semibold text-muted-foreground">Google Place ID, optional</label>
                      <input className={`${inputCls} mt-1.5`} value={values.place_id} disabled={pendingReview} onChange={(e) => setValues({ ...values, place_id: e.target.value })} placeholder="optional" />
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Pentru MVP sunt suficiente coordonatele latitudine/longitudine. Place ID poate fi completat mai tarziu.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Schimbarile nu se publica direct. Dupa trimitere, apar in panoul de administrare pentru verificare.</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={saving || pendingReview} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salveaza draft</button>
                  {draft && draft.status !== "pending_review" && <button disabled={saving || hasCoordinateIssues} onClick={submitDraft} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">Trimite spre review</button>}
                  {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
                </div>
              </section>

              <LocationConfigModal open={activeModal === "services"} title="Servicii locatie" locationName={selectedLocationName} onClose={() => setActiveModal(null)}>
                <ProviderServices locationId={selectedLocation.id} location={selectedLocation} overview={overview || { content_summary: { approved_service_count: 0 } }} onRefresh={onRefresh || (() => {})} />
              </LocationConfigModal>
              <LocationConfigModal open={activeModal === "hours"} title="Program locatie" locationName={selectedLocationName} onClose={() => setActiveModal(null)}>
                <ProviderHours locationId={selectedLocation.id} location={selectedLocation} onRefresh={onRefresh || (() => {})} />
              </LocationConfigModal>
              <LocationConfigModal open={activeModal === "team"} title="Specialisti locatie" locationName={selectedLocationName} onClose={() => setActiveModal(null)}>
                <ProviderTeam locationId={selectedLocation.id} />
              </LocationConfigModal>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
