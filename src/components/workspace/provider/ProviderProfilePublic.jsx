import React, { useEffect, useState } from "react";
import { Building2, ExternalLink, MapPin, Save, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS, PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import { buildGoogleMapsUrl } from "@/lib/maps";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50";
const QUICK_FIELDS = [
  ["public_description", "Descriere organizatie", "textarea", "Prezentare generala a brandului: ce oferiti, cui va adresati si ce va diferentiaza."],
  ["public_phone", "Telefon general", "text", "Telefon general al organizatiei. Telefoanele pe fiecare punct de lucru se gestioneaza in Locatii."],
  ["public_email", "Email general", "text", "Email general al organizatiei sau brandului."],
  ["website_url", "Website", "text", "Exemplu: https://site.ro"],
  ["facebook_url", "Facebook", "text", "Link catre pagina oficiala."],
  ["instagram_url", "Instagram", "text", "Link catre profilul oficial."],
  ["linkedin_url", "LinkedIn", "text", "Optional, util mai ales pentru B2B."],
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PublicStatusItem({ label, value, empty = "Nepublicat" }) {
  const hasValue = Boolean(String(value || "").trim());
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${hasValue ? "text-foreground" : "text-muted-foreground"}`}>{hasValue ? value : empty}</span>
    </div>
  );
}

function LocationSummaryCard({ loc, active, onManage }) {
  const mapUrl = buildGoogleMapsUrl(loc);
  return (
    <div className={`rounded-xl border bg-card p-4 ${active ? "border-foreground" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">{loc.public_display_name || loc.name}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {[loc.address, loc.locality_name || loc.city, loc.county_name || loc.county].filter(Boolean).join(", ") || "Adresa nepublicata"}
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${loc.active_status === "inactiva" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
          {loc.active_status === "inactiva" ? "Inactiva" : "Activa"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-secondary/70 px-3 py-2">
          <div className="text-muted-foreground">Telefon</div>
          <div className="font-semibold truncate">{loc.public_phone || loc.phone_public || "Lipseste"}</div>
        </div>
        <div className="rounded-lg bg-secondary/70 px-3 py-2">
          <div className="text-muted-foreground">Status</div>
          <div className="font-semibold truncate">{PROFILE_CONTROL_LABELS[loc.profile_control_status] || loc.profile_control_status || "-"}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <button onClick={onManage} className="font-semibold underline underline-offset-4">Gestioneaza locatia</button>
        {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Google Maps <ExternalLink className="w-3 h-3" /></a>}
      </div>
    </div>
  );
}

export default function ProviderProfilePublic({ locationId, overview, workspace, onNavigate, onSelectLocation, onRefresh }) {
  const pv = overview.public_preview || {};
  const loc = overview.location || {};
  const locations = workspace?.locations || [];
  const orgName = loc.organization_name || pv.display_name || loc.public_display_name || loc.name;
  const locationCount = locations.length || 1;
  const [quick, setQuick] = useState({
    public_description: pv.description || "",
    public_phone: pv.phone || "",
    public_email: pv.email || "",
    website_url: pv.website || "",
    facebook_url: pv.facebook || "",
    instagram_url: pv.instagram || "",
    linkedin_url: pv.linkedin || "",
  });
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickMsg, setQuickMsg] = useState("");

  const [reviewDraft, setReviewDraft] = useState(null);
  const [reviewValues, setReviewValues] = useState({
    public_display_name: orgName || "",
  });
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  useEffect(() => {
    setQuick({
      public_description: pv.description || "",
      public_phone: pv.phone || "",
      public_email: pv.email || "",
      website_url: pv.website || "",
      facebook_url: pv.facebook || "",
      instagram_url: pv.instagram || "",
      linkedin_url: pv.linkedin || "",
    });
    setReviewValues({ public_display_name: orgName || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const loadOwnDraft = async () => {
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "location_details" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    setReviewDraft(own || null);
    if (own) {
      const payload = JSON.parse(own.payload_json || "{}");
      setReviewValues({ public_display_name: payload.public_display_name ?? (orgName || "") });
    }
  };

  useEffect(() => { loadOwnDraft(); }, [locationId]);

  const saveQuick = async () => {
    setSavingQuick(true); setQuickMsg("");
    const res = await base44.functions.invoke("saveProviderRoutineProfile", { location_id: locationId, ...quick }).catch((e) => ({ data: { error: e.message } }));
    setSavingQuick(false);
    if (res.data?.error) { setQuickMsg(res.data.error); return; }
    setQuickMsg("Informatiile publice ale organizatiei au fost salvate.");
    onRefresh();
  };

  const saveReview = async () => {
    setSavingReview(true); setReviewMsg("");
    const action = reviewDraft && reviewDraft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = { public_display_name: reviewValues.public_display_name || "" };
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: reviewDraft?.id, location_id: locationId, section: "location_details", payload,
    }).catch((e) => ({ data: { error: e.message } }));
    setSavingReview(false);
    if (res.data?.error) { setReviewMsg(res.data.error); return; }
    setReviewMsg("Draft salvat. Trimite-l spre review cand este pregatit.");
    loadOwnDraft();
  };

  const submitReview = async () => {
    if (!reviewDraft) return;
    setSavingReview(true); setReviewMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: reviewDraft.id, location_id: locationId, section: "location_details" }).catch((e) => ({ data: { error: e.message } }));
    setSavingReview(false);
    if (res.data?.error) { setReviewMsg(res.data.error); return; }
    setReviewMsg("Trimis spre review.");
    loadOwnDraft();
  };

  const manageLocation = (id) => {
    if (id && onSelectLocation) onSelectLocation(id);
    if (onNavigate) onNavigate("locations");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public organizatie</h1>
        <p className="mt-1 text-xs text-muted-foreground">Controleaza informatiile generale ale brandului si modul in care sunt prezentate locatiile tale.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-background to-amber-50 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Previzualizare organizatie</div>
              <h2 className="mt-1 font-heading text-2xl font-bold">{orgName}</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                {quick.public_description || "Adauga o descriere generala pentru organizatie. Descrierea locatiei, programul si serviciile se gestioneaza pe fiecare punct de lucru."}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-semibold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" /> {loc.profile_control_status === "verified" ? "Verificat" : "Activ"}
            </span>
          </div>
          <div className="mt-5 grid sm:grid-cols-4 gap-2">
            <PublicStatusItem label="Tip" value={PROVIDER_PROFILE_TYPES[loc.provider_profile_type] || PROVIDER_TYPES[loc.provider_type]} />
            <PublicStatusItem label="Locatii" value={`${locationCount} ${locationCount === 1 ? "locatie" : "locatii"}`} />
            <PublicStatusItem label="Telefon general" value={quick.public_phone} empty="Lipseste" />
            <PublicStatusItem label="Website" value={quick.website_url} empty="Nepublicat" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-sm">Locatii publice ale organizatiei</div>
            <p className="text-xs text-muted-foreground mt-1">Aici apar pe scurt punctele de lucru. Adresa, harta, programul, serviciile si echipa se gestioneaza din modulul Locatii si modulele locatiei selectate.</p>
          </div>
          <button onClick={() => onNavigate && onNavigate("locations")} className="text-xs font-semibold underline underline-offset-4 shrink-0">Vezi toate locatiile</button>
        </div>
        {locations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/50 p-6 text-center">
            <Building2 className="w-6 h-6 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Nu exista locatii in workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">Locatiile aprobate vor aparea aici.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {locations.map((l) => (
              <LocationSummaryCard key={l.id} loc={l} active={l.id === locationId} onManage={() => manageLocation(l.id)} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="font-semibold text-sm">Informatii publice generale</div>
          <p className="text-xs text-muted-foreground mt-1">Acestea sunt date de brand/organizatie. Datele specifice unei locatii se editeaza separat.</p>
        </div>
        {QUICK_FIELDS.map(([key, label, type, hint]) => (
          <Field key={key} label={label} hint={hint}>
            {type === "textarea" ? (
              <textarea className={inputCls} rows={4} value={quick[key]} onChange={(e) => setQuick({ ...quick, [key]: e.target.value })} />
            ) : (
              <input className={inputCls} value={quick[key]} onChange={(e) => setQuick({ ...quick, [key]: e.target.value })} />
            )}
          </Field>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <button disabled={savingQuick} onClick={saveQuick} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
            <Save className="w-4 h-4" /> Salveaza informatiile
          </button>
          {quickMsg && <p className="text-xs text-muted-foreground">{quickMsg}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="font-semibold text-sm">Nume public organizatie — necesita review</div>
          <p className="text-xs text-muted-foreground mt-1">Schimbarea numelui public poate afecta identificarea brandului si este verificata inainte de publicare.</p>
          {reviewDraft && <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary">{SUBMISSION_STATUS_LABELS[reviewDraft.status] || reviewDraft.status}</span>}
        </div>
        <Field label="Nume public afisat" hint="Exemplu: Lunera Optic">
          <input className={inputCls} value={reviewValues.public_display_name || ""} onChange={(e) => setReviewValues({ ...reviewValues, public_display_name: e.target.value })} disabled={reviewDraft?.status === "pending_review"} />
        </Field>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Adresa si harta nu se modifica aici. Pentru fiecare punct de lucru foloseste modulul Locatii.
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={savingReview || reviewDraft?.status === "pending_review"} onClick={saveReview} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border disabled:opacity-50">
            Salveaza draft
          </button>
          {reviewDraft && reviewDraft.status !== "pending_review" && (
            <button disabled={savingReview} onClick={submitReview} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
              Trimite spre review
            </button>
          )}
        </div>
        {reviewMsg && <p className="text-xs text-muted-foreground">{reviewMsg}</p>}
      </div>
    </div>
  );
}