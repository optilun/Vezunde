import React, { useEffect, useState } from "react";
import { Building2, ExternalLink, Globe2, ImagePlus, Loader2, Mail, MapPin, Phone, Plus, Save, Send, ShieldCheck, Store } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS, PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import { buildGoogleMapsUrl } from "@/lib/maps";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";
import SocialBrandIcon from "@/components/common/SocialBrandIcon";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-foreground/50 transition-colors";
const DESCRIPTION_MAX_LENGTH = 500;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 4 * 1024 * 1024;
const LOGO_MAX_DATA_URL_LENGTH = 800000;
const ACTIVE_REVIEW_STATUSES = ["draft", "needs_more_info", "pending_review"];

const SOCIAL_ITEMS = [
  { key: "facebook_url", label: "Facebook", platform: "facebook" },
  { key: "instagram_url", label: "Instagram", platform: "instagram" },
  { key: "linkedin_url", label: "LinkedIn", platform: "linkedin" },
];

const REVIEW_FIELDS = [
  ["public_phone", "Telefon general", "Telefon general al organizatiei.", "+40..."],
  ["public_email", "Email general", "Email general pentru contact.", "contact@firma.ro"],
  ["website_url", "Website", "Link website.", "opticata.ro"],
  ["facebook_url", "Facebook", "Link pagina Facebook.", "facebook.com/opticata"],
  ["instagram_url", "Instagram", "Link profil Instagram.", "instagram.com/opticata"],
  ["linkedin_url", "LinkedIn", "Link pagina LinkedIn.", "linkedin.com/company/opticata"],
];

function initials(name = "") {
  return String(name || "V").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "V";
}

function normalizeClientUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || /\s/.test(raw)) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : raw.startsWith("//") ? `https:${raw}` : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    if (!parsed.hostname || !parsed.hostname.includes(".")) return "";
    return parsed.toString();
  } catch (_e) {
    return "";
  }
}

function displayUrl(value) {
  const safe = normalizeClientUrl(value);
  if (!safe) return "";
  return safe.replace(/^https?:\/\//i, "").replace(/\/$/, "");
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

function BrandLogo({ name, photoUrl, pending, small = false }) {
  const sizeCls = small ? "h-14 w-14 rounded-2xl" : "h-16 w-16 rounded-3xl";
  return (
    <div className={`relative shrink-0 overflow-hidden border border-white/70 bg-white shadow-sm ${sizeCls}`}>
      {photoUrl ? <img src={photoUrl} alt={`Logo ${name}`} className="h-full w-full object-contain p-2" /> : <div className="flex h-full w-full items-center justify-center bg-foreground font-heading text-lg font-black text-background">{initials(name)}</div>}
      {pending && <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[9px] font-bold text-white">review</div>}
    </div>
  );
}

function PreviewMetric({ icon: Icon, label, value, muted }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <div className={`mt-1 truncate text-xs font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function SocialPill({ item, url }) {
  const safeUrl = normalizeClientUrl(url);
  if (!safeUrl) return null;
  return (
    <a href={safeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm hover:bg-white" title={displayUrl(url)}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><SocialBrandIcon platform={item.platform} className="h-3.5 w-3.5" /></span>
      {item.label}
    </a>
  );
}

function SocialLinksPreview({ values }) {
  const visible = SOCIAL_ITEMS.filter((item) => normalizeClientUrl(values[item.key]));
  if (visible.length === 0) return null;
  return <div className="relative mt-4 flex flex-wrap gap-2">{visible.map((item) => <SocialPill key={item.key} item={item} url={values[item.key]} />)}</div>;
}

function LocationSummaryCard({ loc, active, onManage }) {
  const mapUrl = buildGoogleMapsUrl(loc);
  const isInactive = loc.active_status === "inactiva";
  const statusLabel = PROFILE_CONTROL_LABELS[loc.profile_control_status] || loc.profile_control_status || "-";
  return (
    <div className={`rounded-2xl border bg-card p-3.5 transition-all hover:shadow-sm ${active ? "border-foreground shadow-sm" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground"><MapPin className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-bold">{loc.public_display_name || loc.name}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isInactive ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{isInactive ? "Inactiva" : "Activa"}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{[loc.address, loc.locality_name || loc.city, loc.county_name || loc.county].filter(Boolean).join(", ") || "Adresa nepublicata"}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-secondary/70 px-3 py-2"><div className="text-muted-foreground">Telefon</div><div className="truncate font-bold">{loc.public_phone || loc.phone_public || "Lipseste"}</div></div>
        <div className="rounded-xl bg-secondary/70 px-3 py-2"><div className="text-muted-foreground">Status</div><div className="truncate font-bold">{statusLabel}</div></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <button onClick={onManage} className="rounded-full bg-foreground px-3 py-1.5 font-semibold text-background transition-opacity hover:opacity-90">Gestioneaza</button>
        {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">Maps <ExternalLink className="w-3 h-3" /></a>}
      </div>
    </div>
  );
}

function OrganizationPreview({ orgName, profileTypeLabel, loc, values, logoPreview, hasPendingLogo, locationCount }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
      <div className="relative p-5" style={{ background: "linear-gradient(135deg, #fffaf2 0%, #ffffff 46%, #f4f1ea 100%)" }}>
        <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-amber-100/60" />
        <div className="relative flex gap-4">
          <BrandLogo name={orgName} photoUrl={logoPreview} pending={hasPendingLogo} />
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">Previzualizare organizatie</div>
            <h2 className="mt-1 truncate font-heading text-2xl font-extrabold tracking-tight">{values.public_display_name || orgName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">{profileTypeLabel}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 shadow-sm"><ShieldCheck className="h-3.5 w-3.5" /> {loc.profile_control_status === "verified" ? "Verificat" : "Activ"}</span>
              {hasPendingLogo && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 shadow-sm">Logo in review</span>}
            </div>
          </div>
        </div>
        <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground line-clamp-4">{values.public_description || "Adauga o descriere generala pentru organizatie. Descrierea locatiei, programul si serviciile se gestioneaza pe fiecare punct de lucru."}</p>
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <PreviewMetric icon={Store} label="Locatii" value={`${locationCount} ${locationCount === 1 ? "locatie" : "locatii"}`} />
          <PreviewMetric icon={Phone} label="Telefon" value={values.public_phone || "Lipseste"} muted={!values.public_phone} />
          <PreviewMetric icon={Mail} label="Email" value={values.public_email || "Lipseste"} muted={!values.public_email} />
          <PreviewMetric icon={Globe2} label="Website" value={displayUrl(values.website_url) || "Nepublicat"} muted={!values.website_url} />
        </div>
        <SocialLinksPreview values={values} />
      </div>
    </div>
  );
}

function initialReviewValues(pv, orgName) {
  return {
    public_display_name: pv.display_name || orgName || "",
    public_description: String(pv.description || "").slice(0, DESCRIPTION_MAX_LENGTH),
    public_phone: pv.phone || "",
    public_email: pv.email || "",
    website_url: pv.website || "",
    facebook_url: pv.facebook || "",
    instagram_url: pv.instagram || "",
    linkedin_url: pv.linkedin || "",
  };
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

  const [values, setValues] = useState(initialReviewValues(pv, orgName));
  const [logoPreview, setLogoPreview] = useState(pendingLogoUrl || pv.photo_url || "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState(hasPendingLogo ? "Logo in curs de verificare. Il vei vedea public dupa aprobarea admin." : "");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const descriptionCount = values.public_description.length;
  const pendingReview = draft?.status === "pending_review";

  useEffect(() => {
    setValues(initialReviewValues(pv, orgName));
    setLogoPreview(pendingLogoUrl || pv.photo_url || "");
    setLogoMsg(hasPendingLogo ? "Logo in curs de verificare. Il vei vedea public dupa aprobarea admin." : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, pendingLogoUrl, pv.photo_url]);

  const loadOwnDraft = async () => {
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "public_profile" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    setDraft(own || null);
    if (own) {
      const payload = JSON.parse(own.payload_json || "{}");
      setValues({ ...initialReviewValues(pv, orgName), ...payload });
    }
  };

  useEffect(() => { loadOwnDraft(); }, [locationId]);

  const setField = (key, value) => setValues((cur) => ({ ...cur, [key]: value }));

  const saveDraft = async () => {
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = {
      ...values,
      public_description: String(values.public_description || "").slice(0, DESCRIPTION_MAX_LENGTH),
    };
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: draft?.id, location_id: locationId, section: "public_profile", payload }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat. Trimite-l spre review cand este pregatit.");
    loadOwnDraft();
  };

  const submitDraft = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "public_profile" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Profilul public a fost trimis spre review.");
    loadOwnDraft();
    onRefresh && onRefresh();
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

  const logoInput = (
    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
  );

  const manageLocation = (id) => { if (id && onSelectLocation) onSelectLocation(id); if (onNavigate) onNavigate("locations"); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public organizatie</h1>
        <p className="mt-1 text-xs text-muted-foreground">Date generale de brand. Adresa, programul, serviciile si specialistii se gestioneaza separat pe fiecare locatie.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_390px] xl:items-start">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">Informatii publice generale</div>
                <p className="text-xs text-muted-foreground mt-1">Modificarile devin publice doar dupa aprobare admin.</p>
              </div>
              {draft && <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
            </div>

            <div className="rounded-2xl border border-border bg-secondary/35 p-4">
              <div className="flex items-center gap-3">
                <label className="relative block cursor-pointer shrink-0" title={logoPreview ? "Schimba logo" : "Adauga logo"}>
                  <BrandLogo name={values.public_display_name || orgName} photoUrl={logoPreview} pending={hasPendingLogo} small />
                  <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-foreground text-background shadow-sm">
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </span>
                  {logoInput}
                </label>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Logo / imagine profil</div>
                  <p className="mt-1 text-xs text-muted-foreground">Logo-ul merge la aprobare inainte sa fie public.</p>
                  <label className="mt-2 inline-block cursor-pointer text-xs font-semibold underline underline-offset-4">
                    {logoPreview ? "Schimba logo" : "Adauga logo"}
                    {logoInput}
                  </label>
                </div>
              </div>
              {logoMsg && <p className={`mt-3 text-xs ${hasPendingLogo || logoMsg.includes("curs") ? "text-amber-700" : "text-muted-foreground"}`}>{logoMsg}</p>}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground"><ImagePlus className="h-3.5 w-3.5" /> Publicare dupa aprobare admin</div>
            </div>

            <Field label="Nume public organizatie" hint="Exemplu: Lunera Optic">
              <input className={inputCls} value={values.public_display_name || ""} onChange={(e) => setField("public_display_name", e.target.value)} disabled={pendingReview} />
            </Field>

            <Field label="Descriere organizatie">
              <textarea className={inputCls} rows={7} maxLength={DESCRIPTION_MAX_LENGTH} value={values.public_description || ""} onChange={(e) => setField("public_description", e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))} disabled={pendingReview} />
              <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] leading-relaxed text-muted-foreground">
                <p>Prezentare generala a brandului: ce oferiti, cui va adresati si ce va diferentiaza.</p>
                <span className="shrink-0 font-semibold">{descriptionCount}/{DESCRIPTION_MAX_LENGTH}</span>
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              {REVIEW_FIELDS.map(([key, label, hint, placeholder]) => (
                <Field key={key} label={label} hint={hint}>
                  <input className={inputCls} placeholder={placeholder} value={values[key] || ""} onChange={(e) => setField(key, e.target.value)} disabled={pendingReview} />
                </Field>
              ))}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Adresa, harta, telefonul locatiei, programul, serviciile si specialistii se gestioneaza din modulul Locatii.</div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button disabled={saving || pendingReview} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-secondary"><Save className="w-4 h-4" /> Salveaza draft</button>
              {draft && draft.status !== "pending_review" && <button disabled={saving} onClick={submitDraft} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Send className="w-4 h-4" /> Trimite spre review</button>}
              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
            </div>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <OrganizationPreview orgName={orgName} profileTypeLabel={profileTypeLabel} loc={loc} values={values} logoPreview={logoPreview} hasPendingLogo={hasPendingLogo} locationCount={locationCount} />

          <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold text-sm"><Building2 className="h-4 w-4" /> Locatii</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Preview pentru punctele de lucru.</p>
              </div>
              <button onClick={() => onNavigate && onNavigate("locations")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary shrink-0">Vezi</button>
            </div>
            {locations.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/50 p-5 text-center"><Building2 className="w-5 h-5 mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nu exista locatii</p></div>
            ) : (
              <div className="mt-4 space-y-3">
                {locations.slice(0, 3).map((location) => <LocationSummaryCard key={location.id} loc={location} active={location.id === locationId} onManage={() => manageLocation(location.id)} />)}
                {locations.length > 3 && <button onClick={() => onNavigate && onNavigate("locations")} className="w-full rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">Vezi toate cele {locations.length} locatii</button>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
