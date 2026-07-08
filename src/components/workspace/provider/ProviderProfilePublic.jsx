import React, { useEffect, useState } from "react";
import { Building2, ExternalLink, Globe2, ImagePlus, Loader2, Mail, MapPin, Phone, Save, ShieldCheck, Store, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS, PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import { buildGoogleMapsUrl } from "@/lib/maps";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-foreground/50 transition-colors";
const QUICK_FIELDS = [
  ["public_phone", "Telefon general", "text", "Telefon general al organizatiei. Telefoanele pe fiecare punct de lucru se gestioneaza in Locatii."],
  ["public_email", "Email general", "text", "Email general al organizatiei sau brandului."],
  ["website_url", "Website", "text", "Exemplu: https://site.ro"],
  ["facebook_url", "Facebook", "text", "Link catre pagina oficiala."],
  ["instagram_url", "Instagram", "text", "Link catre profilul oficial."],
  ["linkedin_url", "LinkedIn", "text", "Optional, util mai ales pentru B2B."],
];
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 4 * 1024 * 1024;
const LOGO_MAX_DATA_URL_LENGTH = 800000;

function initials(name = "") {
  return String(name || "V").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "V";
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imaginea nu poate fi citita.")); };
    img.src = url;
  });
}

async function makeSafeLogoDataUrl(file) {
  const img = await readImage(file);
  const canvas = document.createElement("canvas");
  const maxSide = 512;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * ratio));
  canvas.height = Math.max(1, Math.round(img.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let dataUrl = canvas.toDataURL("image/webp", 0.82);
  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) throw new Error("Logo-ul este inca prea mare dupa optimizare. Incearca o imagine mai simpla.");
  return dataUrl;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, muted }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`mt-1 text-sm font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function BrandLogo({ name, photoUrl, pending }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-3xl border border-white/70 bg-white shadow-sm">
      {photoUrl ? (
        <img src={photoUrl} alt={`Logo ${name}`} className="h-full w-full object-contain p-2" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-foreground font-heading text-lg font-black text-background">{initials(name)}</div>
      )}
      {pending && <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[9px] font-bold text-white">review</div>}
    </div>
  );
}

function LocationSummaryCard({ loc, active, onManage }) {
  const mapUrl = buildGoogleMapsUrl(loc);
  const isInactive = loc.active_status === "inactiva";
  const statusLabel = PROFILE_CONTROL_LABELS[loc.profile_control_status] || loc.profile_control_status || "-";
  return (
    <div className={`group rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${active ? "border-foreground shadow-sm" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground"><MapPin className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-bold">{loc.public_display_name || loc.name}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isInactive ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{isInactive ? "Inactiva" : "Activa"}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{[loc.address, loc.locality_name || loc.city, loc.county_name || loc.county].filter(Boolean).join(", ") || "Adresa nepublicata"}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-secondary/70 px-3 py-2.5"><div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" /> Telefon</div><div className="mt-0.5 truncate font-bold">{loc.public_phone || loc.phone_public || "Lipseste"}</div></div>
        <div className="rounded-xl bg-secondary/70 px-3 py-2.5"><div className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Status</div><div className="mt-0.5 truncate font-bold">{statusLabel}</div></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <button onClick={onManage} className="rounded-full bg-foreground px-3 py-1.5 font-semibold text-background transition-opacity hover:opacity-90">Gestioneaza locatia</button>
        {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">Google Maps <ExternalLink className="w-3 h-3" /></a>}
      </div>
    </div>
  );
}

export default function ProviderProfilePublic({ locationId, overview, workspace, onNavigate, onSelectLocation, onRefresh }) {
  const pv = overview.public_preview || {};
  const loc = overview.location || {};
  const pendingProfile = overview.pending_profile_changes || {};
  const pendingLogoUrl = pendingProfile.pending_logo_url || "";
  const hasPendingLogo = !!pendingProfile.has_pending_logo;
  const locations = workspace?.locations || [];
  const orgName = loc.organization_name || pv.display_name || loc.public_display_name || loc.name;
  const locationCount = locations.length || 1;
  const profileTypeLabel = PROVIDER_PROFILE_TYPES[loc.provider_profile_type] || PROVIDER_TYPES[loc.provider_type] || "Profil";
  const [quick, setQuick] = useState({
    public_description: pv.description || "",
    public_phone: pv.phone || "",
    public_email: pv.email || "",
    website_url: pv.website || "",
    facebook_url: pv.facebook || "",
    instagram_url: pv.instagram || "",
    linkedin_url: pv.linkedin || "",
  });
  const [logoPreview, setLogoPreview] = useState(pendingLogoUrl || pv.photo_url || "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState(hasPendingLogo ? "Logo in curs de verificare. Il vei vedea public dupa aprobarea admin." : "");
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickMsg, setQuickMsg] = useState("");
  const [reviewDraft, setReviewDraft] = useState(null);
  const [reviewValues, setReviewValues] = useState({ public_display_name: orgName || "" });
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
    setLogoPreview(pendingLogoUrl || pv.photo_url || "");
    setLogoMsg(hasPendingLogo ? "Logo in curs de verificare. Il vei vedea public dupa aprobarea admin." : "");
    setReviewValues({ public_display_name: orgName || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, pendingLogoUrl, pv.photo_url]);

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

  const uploadLogo = async (file) => {
    setLogoMsg("");
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) { setLogoMsg("Format acceptat: PNG, JPG sau WEBP."); return; }
    if (file.size > LOGO_MAX_BYTES) { setLogoMsg("Logo-ul trebuie sa aiba maximum 4MB inainte de optimizare."); return; }
    setUploadingLogo(true);
    try {
      const dataUrl = await makeSafeLogoDataUrl(file);
      setLogoPreview(dataUrl);
      const res = await base44.functions.invoke("submitProviderLogoForReview", { location_id: locationId, photo_url: dataUrl }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
      if (res.data?.error) throw new Error(res.data.error);
      setLogoMsg("Logo in curs de verificare. Il vei vedea public dupa aprobarea admin.");
      await onRefresh();
    } catch (error) {
      setLogoPreview(pendingLogoUrl || pv.photo_url || "");
      setLogoMsg(error.message || "Nu am putut incarca logo-ul.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveReview = async () => {
    setSavingReview(true); setReviewMsg("");
    const action = reviewDraft && reviewDraft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = { public_display_name: reviewValues.public_display_name || "" };
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: reviewDraft?.id, location_id: locationId, section: "location_details", payload }).catch((e) => ({ data: { error: e.message } }));
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

  const manageLocation = (id) => { if (id && onSelectLocation) onSelectLocation(id); if (onNavigate) onNavigate("locations"); };

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public organizatie</h1>
        <p className="mt-1 text-xs text-muted-foreground">Controleaza informatiile generale ale brandului si modul in care sunt prezentate locatiile tale.</p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
        <div className="relative p-5 sm:p-7" style={{ background: "linear-gradient(135deg, #fffaf2 0%, #ffffff 44%, #f4f1ea 100%)" }}>
          <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-amber-100/60" />
          <div className="relative flex gap-4">
            <BrandLogo name={orgName} photoUrl={logoPreview} pending={hasPendingLogo} />
            <div>
              <div className="text-xs font-medium text-muted-foreground">Previzualizare organizatie</div>
              <h2 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">{orgName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">{profileTypeLabel}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 shadow-sm"><ShieldCheck className="h-3.5 w-3.5" /> {loc.profile_control_status === "verified" ? "Verificat" : "Activ"}</span>
                {hasPendingLogo && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 shadow-sm">Logo in review</span>}
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{quick.public_description || "Adauga o descriere generala pentru organizatie. Descrierea locatiei, programul si serviciile se gestioneaza pe fiecare punct de lucru."}</p>
            </div>
          </div>
          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Store} label="Locatii" value={`${locationCount} ${locationCount === 1 ? "locatie" : "locatii"}`} />
            <MetricCard icon={Phone} label="Telefon general" value={quick.public_phone || "Lipseste"} muted={!quick.public_phone} />
            <MetricCard icon={Mail} label="Email general" value={quick.public_email || "Lipseste"} muted={!quick.public_email} />
            <MetricCard icon={Globe2} label="Website" value={quick.website_url || "Nepublicat"} muted={!quick.website_url} />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 font-semibold text-sm"><Building2 className="h-4 w-4" /> Locatii publice ale organizatiei</div><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Aici apar pe scurt punctele de lucru. Adresa, harta, programul, serviciile si echipa se gestioneaza din modulul Locatii si modulele locatiei selectate.</p></div>
          <button onClick={() => onNavigate && onNavigate("locations")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary shrink-0">Vezi toate locatiile</button>
        </div>
        {locations.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/50 p-6 text-center"><Building2 className="w-6 h-6 mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nu exista locatii in workspace</p><p className="mt-1 text-xs text-muted-foreground">Locatiile aprobate vor aparea aici.</p></div> : <div className="mt-4 grid gap-4 md:grid-cols-2">{locations.map((l) => <LocationSummaryCard key={l.id} loc={l} active={l.id === locationId} onManage={() => manageLocation(l.id)} />)}</div>}
      </div>

      <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm space-y-5">
        <div><div className="font-semibold text-sm">Informatii publice generale</div><p className="text-xs text-muted-foreground mt-1">Acestea sunt date de brand/organizatie. Datele specifice unei locatii se editeaza separat.</p></div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.8fr]">
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-3"><BrandLogo name={orgName} photoUrl={logoPreview} pending={hasPendingLogo} /><div><div className="text-sm font-semibold">Logo / imagine profil</div><p className="mt-1 text-xs text-muted-foreground">Alege un logo. Imaginea merge la aprobare inainte sa fie publica.</p></div></div>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-center hover:bg-secondary/60">
              {uploadingLogo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span className="mt-2 text-sm font-semibold">Alege logo</span>
              <span className="mt-1 text-[11px] text-muted-foreground">PNG, JPG sau WEBP · optimizat automat</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {logoMsg && <p className={`mt-3 text-xs ${hasPendingLogo || logoMsg.includes("curs") ? "text-amber-700" : "text-muted-foreground"}`}>{logoMsg}</p>}
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground"><ImagePlus className="h-3.5 w-3.5" /> Publicare dupa aprobare admin</div>
          </div>
          <Field label="Descriere organizatie" hint="Prezentare generala a brandului: ce oferiti, cui va adresati si ce va diferentiaza."><textarea className={inputCls} rows={7} value={quick.public_description} onChange={(e) => setQuick({ ...quick, public_description: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{QUICK_FIELDS.map(([key, label, type, hint]) => <Field key={key} label={label} hint={hint}><input className={inputCls} value={quick[key]} onChange={(e) => setQuick({ ...quick, [key]: e.target.value })} /></Field>)}</div>
        <div className="flex items-center gap-3 pt-1"><button disabled={savingQuick} onClick={saveQuick} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Save className="w-4 h-4" /> Salveaza informatiile</button>{quickMsg && <p className="text-xs text-muted-foreground">{quickMsg}</p>}</div>
      </div>

      <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm space-y-4">
        <div><div className="font-semibold text-sm">Nume public organizatie — necesita review</div><p className="text-xs text-muted-foreground mt-1">Schimbarea numelui public poate afecta identificarea brandului si este verificata inainte de publicare.</p>{reviewDraft && <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary">{SUBMISSION_STATUS_LABELS[reviewDraft.status] || reviewDraft.status}</span>}</div>
        <Field label="Nume public afisat" hint="Exemplu: Lunera Optic"><input className={inputCls} value={reviewValues.public_display_name || ""} onChange={(e) => setReviewValues({ ...reviewValues, public_display_name: e.target.value })} disabled={reviewDraft?.status === "pending_review"} /></Field>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Adresa si harta nu se modifica aici. Pentru fiecare punct de lucru foloseste modulul Locatii.</div>
        <div className="flex flex-wrap gap-2"><button disabled={savingReview || reviewDraft?.status === "pending_review"} onClick={saveReview} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-secondary">Salveaza draft</button>{reviewDraft && reviewDraft.status !== "pending_review" && <button disabled={savingReview} onClick={submitReview} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">Trimite spre review</button>}</div>
        {reviewMsg && <p className="text-xs text-muted-foreground">{reviewMsg}</p>}
      </div>
    </div>
  );
}
