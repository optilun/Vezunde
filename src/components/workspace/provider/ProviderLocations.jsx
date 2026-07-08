import React, { useEffect, useState } from "react";
import { ArrowRight, Building2, Clock, ExternalLink, Mail, MapPin, Phone, Plus, Save, ShieldCheck, Store, Wrench, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PROFILE_CONTROL_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl, hasMapLocation } from "@/lib/maps";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-foreground/50 transition-colors";

function LocationCard({ loc, membership, active, onSelect }) {
  const statusLabel = PROFILE_CONTROL_LABELS[loc.profile_control_status] || loc.profile_control_status || "-";
  const activeStatus = loc.active_status === "inactiva" ? "Inactiva" : "Activa";
  return (
    <button
      type="button"
      onClick={() => onSelect(loc.id)}
      className={`w-full rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${active ? "border-foreground shadow-sm" : "border-border"}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-bold">{loc.public_display_name || loc.name}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeStatus === "Activa" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{activeStatus}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{loc.locality_name || loc.city || "Localitate lipsa"} · {statusLabel}</p>
          {loc.address && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{loc.address}</p>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-secondary/70 px-3 py-2">
          <div className="text-muted-foreground">Completitudine</div>
          <div className="font-bold">{membership?.profile_completeness ?? 0}%</div>
        </div>
        <div className="rounded-xl bg-secondary/70 px-3 py-2">
          <div className="text-muted-foreground">Status</div>
          <div className="font-bold">{statusLabel}</div>
        </div>
      </div>
      <div className="mt-3 text-xs font-semibold text-foreground">{active ? "Locatie selectata" : "Selecteaza locatia"}</div>
    </button>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/45 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-sm font-bold break-words">{value || "Lipseste"}</div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, text, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Icon className="h-4 w-4" /></div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
        </div>
      </div>
    </button>
  );
}

export default function ProviderLocations({ workspace, selectedLocationId, onSelect, onNavigate, onRefresh }) {
  const locById = Object.fromEntries((workspace.locations || []).map((l) => [l.id, l]));
  const membershipByLocation = Object.fromEntries((workspace.memberships || []).map((m) => [m.location_id, m]));
  const selectedLocation = locById[selectedLocationId] || (workspace.locations || [])[0] || null;
  const selectedMembership = selectedLocation ? membershipByLocation[selectedLocation.id] : null;
  const mapUrl = selectedLocation ? buildGoogleMapsUrl(selectedLocation) : "";
  const embedUrl = selectedLocation ? buildGoogleMapsEmbedUrl(selectedLocation) : "";
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({ public_display_name: "", address: "", public_phone: "", public_email: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
      });
    } else {
      setValues({
        public_display_name: selectedLocation.public_display_name || selectedLocation.name || "",
        address: selectedLocation.address || "",
        public_phone: selectedLocation.public_phone || selectedLocation.phone_public || "",
        public_email: selectedLocation.public_email || "",
      });
    }
  };

  useEffect(() => { loadDraft(); setMsg(""); }, [selectedLocation?.id]);

  const saveDraft = async () => {
    if (!selectedLocation?.id) return;
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = {
      public_display_name: values.public_display_name || "",
      address: values.address || "",
      public_phone: values.public_phone || "",
      public_email: values.public_email || "",
    };
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action,
      submission_id: draft?.id,
      location_id: selectedLocation.id,
      section: "location_details",
      payload,
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat. Trimite-l spre review cand este pregatit.");
    loadDraft();
    onRefresh && onRefresh();
  };

  const submitDraft = async () => {
    if (!draft || !selectedLocation?.id) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action: "submit",
      submission_id: draft.id,
      location_id: selectedLocation.id,
      section: "location_details",
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Modificarea locatiei a fost trimisa spre review.");
    loadDraft();
    onRefresh && onRefresh();
  };

  const locationCount = workspace.locations?.length || 0;
  const hasMultipleLocations = locationCount > 1;
  const pendingReview = draft?.status === "pending_review";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Gestioneaza punctele de lucru ale organizatiei. Serviciile, programul si echipa se configureaza separat pentru fiecare locatie selectata.
          </p>
        </div>
        <Link to="/adauga-sau-revendica" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
          <Plus className="h-4 w-4" /> Adauga locatie
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Puncte de lucru</div>
                <p className="mt-1 text-xs text-muted-foreground">{locationCount} {locationCount === 1 ? "locatie administrata" : "locatii administrate"}</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{hasMultipleLocations ? "Multi-locatie" : "O locatie"}</span>
            </div>
            <div className="mt-4 space-y-3">
              {(workspace.locations || []).map((loc) => (
                <LocationCard key={loc.id} loc={loc} membership={membershipByLocation[loc.id]} active={loc.id === selectedLocation?.id} onSelect={onSelect} />
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-dashed border-border bg-secondary/35 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card"><Building2 className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-bold">Adaugi un magazin sau cabinet nou?</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Trimiti o cerere de locatie noua. Dupa aprobare, apare aici si poti seta serviciile, programul si echipa separat.
                </p>
                <Link to="/adauga-sau-revendica" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-4">
                  Cere adaugarea unei locatii <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {selectedLocation && (
            <>
              <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-xl font-extrabold tracking-tight">{selectedLocation.public_display_name || selectedLocation.name}</h2>
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800">{PROFILE_CONTROL_LABELS[selectedLocation.profile_control_status] || selectedLocation.profile_control_status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedLocation.locality_name || selectedLocation.city} {selectedLocation.county_name ? `· ${selectedLocation.county_name}` : ""}</p>
                  </div>
                  {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                      Google Maps <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DetailItem icon={MapPin} label="Adresa" value={selectedLocation.address} />
                  <DetailItem icon={Phone} label="Telefon locatie" value={selectedLocation.public_phone || selectedLocation.phone_public} />
                  <DetailItem icon={Mail} label="Email locatie" value={selectedLocation.public_email} />
                  <DetailItem icon={ShieldCheck} label="Completitudine" value={`${selectedMembership?.profile_completeness ?? 0}%`} />
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-secondary h-80">
                  {hasMapLocation(selectedLocation) && embedUrl ? (
                    <iframe
                      title={`Harta ${selectedLocation.public_display_name || selectedLocation.name}`}
                      src={embedUrl}
                      className="h-full w-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MapPin className="h-7 w-7 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium">Harta nu poate fi afisata inca</p>
                      <p className="mt-1 text-xs text-muted-foreground">Adauga adresa locatiei ca sa putem genera linkul de harta.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <ActionCard icon={Wrench} title="Servicii locatie" text="Serviciile se aleg pentru locatia selectata, nu pentru toata organizatia." onClick={() => onNavigate && onNavigate("services")} />
                <ActionCard icon={Clock} title="Program locatie" text="Programul se gestioneaza separat pentru fiecare punct de lucru." onClick={() => onNavigate && onNavigate("hours")} />
                <ActionCard icon={Users} title="Echipa locatie" text="Specialistii pot fi asociati cu una sau mai multe locatii." onClick={() => onNavigate && onNavigate("team")} />
              </div>

              <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold">Modificari locatie</div>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">Necesita review</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Numele locatiei, adresa si contactul public sunt verificate inainte de publicare.</p>
                  </div>
                  {draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Nume public locatie</label>
                    <input className={`${inputCls} mt-1.5`} value={values.public_display_name} disabled={pendingReview} onChange={(e) => setValues({ ...values, public_display_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Adresa</label>
                    <input className={`${inputCls} mt-1.5`} value={values.address} disabled={pendingReview} onChange={(e) => setValues({ ...values, address: e.target.value })} />
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

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                  Schimbarile trimise aici nu se publica direct. Ele apar in panoul de administrare pentru verificare.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={saving || pendingReview} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salveaza draft</button>
                  {draft && draft.status !== "pending_review" && <button disabled={saving} onClick={submitDraft} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">Trimite spre review</button>}
                  {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
