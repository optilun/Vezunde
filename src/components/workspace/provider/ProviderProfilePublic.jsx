import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Globe2,
  ImagePlus,
  Loader2,
  Mail,
  Phone,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Store,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";
import SocialBrandIcon from "@/components/common/SocialBrandIcon";

const inputCls = "min-h-12 w-full rounded-[14px] border border-[#d9d4ca] bg-[#fbfaf7] px-4 py-3.5 text-[15px] leading-relaxed text-[#171717] outline-none transition-[border-color,box-shadow,background-color] focus:border-[#345bc8] focus:bg-white focus:ring-4 focus:ring-[#345bc8]/10 disabled:cursor-not-allowed disabled:opacity-60";
const DESCRIPTION_MAX_LENGTH = 500;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 4 * 1024 * 1024;
const LOGO_MAX_OPTIMIZED_BYTES = 1024 * 1024;

const PROFILE_FIELDS = [
  "public_display_name",
  "public_description",
  "public_phone",
  "public_email",
  "website_url",
  "facebook_url",
  "instagram_url",
  "linkedin_url",
];

const FIELD_LABELS = {
  public_display_name: "Nume public organizație",
  public_description: "Descriere organizație",
  public_phone: "Telefon general",
  public_email: "Email general",
  website_url: "Website",
  facebook_url: "Facebook",
  instagram_url: "Instagram",
  linkedin_url: "LinkedIn",
};

const SOCIAL_ITEMS = [
  { key: "facebook_url", label: "Facebook", platform: "facebook" },
  { key: "instagram_url", label: "Instagram", platform: "instagram" },
  { key: "linkedin_url", label: "LinkedIn", platform: "linkedin" },
];

function initials(name = "") {
  return String(name || "V")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "V";
}

function normalizeClientUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || /\s/.test(raw)) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw)
    ? raw
    : raw.startsWith("//")
      ? `https:${raw}`
      : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) return "";
    return parsed.toString();
  } catch (_error) {
    return "";
  }
}

function displayUrl(value) {
  const safe = normalizeClientUrl(value);
  return safe ? safe.replace(/^https?:\/\//i, "").replace(/\/$/, "") : "";
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imaginea nu poate fi citită."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Logo-ul nu a putut fi optimizat."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

async function makeSafeLogoFile(file, organizationId) {
  const image = await readImage(file);
  const canvas = document.createElement("canvas");
  const maxSide = 512;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Logo-ul nu a putut fi procesat.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await canvasToBlob(canvas, "image/webp", 0.86);
  let type = "image/webp";
  let extension = "webp";
  if (blob.size > LOGO_MAX_OPTIMIZED_BYTES) {
    const jpegCanvas = document.createElement("canvas");
    jpegCanvas.width = canvas.width;
    jpegCanvas.height = canvas.height;
    const jpegContext = jpegCanvas.getContext("2d");
    if (!jpegContext) throw new Error("Logo-ul nu a putut fi procesat.");
    jpegContext.fillStyle = "#ffffff";
    jpegContext.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    jpegContext.drawImage(canvas, 0, 0);
    blob = await canvasToBlob(jpegCanvas, "image/jpeg", 0.76);
    type = "image/jpeg";
    extension = "jpg";
  }
  if (blob.size > LOGO_MAX_OPTIMIZED_BYTES) throw new Error("Logo-ul este prea mare după optimizare. Încearcă o imagine mai simplă.");
  return new File([blob], `organization-${organizationId || "logo"}-${Date.now()}.${extension}`, { type, lastModified: Date.now() });
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#2d2b27]">{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-2 text-[13px] leading-relaxed text-[#706c64]">{hint}</p>}
    </div>
  );
}

function BrandLogo({ name, photoUrl, pending, small = false }) {
  const sizeClass = small ? "h-12 w-12 rounded-[14px]" : "h-[72px] w-[72px] rounded-[20px]";
  return (
    <div className={`relative shrink-0 overflow-hidden border border-[#171717]/10 bg-white shadow-[0_8px_24px_rgba(23,23,23,0.08)] ${sizeClass}`}>
      {photoUrl ? <img src={photoUrl} alt={`Logo ${name}`} className="h-full w-full object-contain p-2" /> : <div className="flex h-full w-full items-center justify-center bg-foreground font-heading text-lg font-black text-background">{initials(name)}</div>}
      {pending && <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[9px] font-bold text-white">în verificare</div>}
    </div>
  );
}

function PreviewMetric({ icon: Icon, label, value, muted }) {
  return (
    <div className="rounded-[14px] border border-[#171717]/10 bg-[#f8f4ec]/90 px-3.5 py-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#706c64]"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`mt-1 text-sm font-bold leading-snug ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function SocialPill({ item, url }) {
  const safeUrl = normalizeClientUrl(url);
  if (!safeUrl) return null;
  return (
    <a href={safeUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#171717]/10 bg-[#f8f4ec]/90 px-3 py-1 text-[13px] font-semibold text-foreground transition-colors hover:bg-white" title={displayUrl(url)}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><SocialBrandIcon platform={item.platform} className="h-3.5 w-3.5" /></span>
      {item.label}
    </a>
  );
}

function OrganizationPreview({ organizationName, profileTypeLabel, verified, values, logoPreview, hasPendingLogo, locationCount, location, onManageLocation }) {
  const socialItems = SOCIAL_ITEMS.filter((item) => normalizeClientUrl(values[item.key]));
  const locationName = location?.public_display_name || location?.name || "Locația principală";
  const locality = location?.locality_name || location?.city || "Localitate necompletată";
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#171717]/15 bg-[#eef3f7] shadow-[0_14px_34px_rgba(23,23,23,0.07)]">
      <div
        className="relative overflow-hidden p-5 sm:p-6"
        style={{
          backgroundColor: "#eef3f7",
          backgroundImage: "radial-gradient(circle, rgba(23,23,23,0.075) 0.7px, transparent 0.7px), linear-gradient(135deg, rgba(255,255,255,0.55), transparent 52%)",
          backgroundSize: "20px 20px, 100% 100%",
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[#345bc8]/20 bg-[#dfe8f5]/70" />
        <div className="pointer-events-none absolute right-5 top-5 h-3 w-3 bg-[#171717]" />
        <div className="pointer-events-none absolute right-8 top-[26px] h-px w-16 bg-[#171717]/25" />
        <div className="relative flex gap-4 pr-8">
          <BrandLogo name={organizationName} photoUrl={logoPreview} pending={hasPendingLogo} />
          <div className="min-w-0">
            <div className="font-heading text-[13px] font-semibold text-[#5d6470]">Previzualizare organizație</div>
            <h2 className="mt-1 line-clamp-2 font-heading text-[1.8rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#171717]">{values.public_display_name || organizationName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#171717]/10 bg-[#f8f4ec]/90 px-3 py-1 text-[13px] font-semibold">{profileTypeLabel}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border border-[#171717]/5 px-3 py-1 text-[13px] font-bold ${verified ? "bg-[#dcead8] text-[#315c3a]" : "bg-[#f8f4ec]/90 text-foreground"}`}>
                <ShieldCheck className="h-3.5 w-3.5" /> {verified ? "Locație verificată" : "Activ"}
              </span>
              {hasPendingLogo && <span className="rounded-full bg-[#f1e1b9] px-3 py-1 text-[13px] font-bold text-[#76551f]">Logo în verificare</span>}
            </div>
          </div>
        </div>
        <p className="relative mt-5 line-clamp-3 border-t border-[#171717]/15 pt-4 text-[15px] leading-[1.65] text-[#514e48]">{values.public_description || "Adaugă o descriere generală pentru organizație. Datele punctelor de lucru se gestionează separat."}</p>
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <PreviewMetric icon={Store} label="Locații" value={`${locationCount} ${locationCount === 1 ? "locație" : "locații"}`} />
          <PreviewMetric icon={Phone} label="Telefon" value={values.public_phone || "Lipsește"} muted={!values.public_phone} />
          <PreviewMetric icon={Mail} label="Email" value={values.public_email || "Lipsește"} muted={!values.public_email} />
          <PreviewMetric icon={Globe2} label="Website" value={displayUrl(values.website_url) || "Nepublicat"} muted={!values.website_url} />
        </div>
        {socialItems.length > 0 && <div className="relative mt-4 flex flex-wrap gap-2">{socialItems.map((item) => <SocialPill key={item.key} item={item} url={values[item.key]} />)}</div>}
        <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-[#171717]/15 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8f4ec]/90 text-[#5d5a54]"><Store className="h-4 w-4" /></span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#706c64]">Locație selectată</div>
              <div className="truncate text-sm font-bold text-[#171717]">{locationName} <span className="font-normal text-[#77736b]">· {locality}</span></div>
            </div>
          </div>
          <button type="button" onClick={() => onManageLocation(location?.id)} className="min-h-10 shrink-0 rounded-full border border-[#171717]/15 bg-[#f8f4ec]/90 px-3.5 text-[13px] font-semibold text-[#171717] transition-colors hover:bg-white">Gestionează</button>
        </div>
      </div>
    </div>
  );
}

function canonicalValues(organization) {
  return {
    public_display_name: organization.public_display_name || "",
    public_description: String(organization.public_description || "").slice(0, DESCRIPTION_MAX_LENGTH),
    public_phone: organization.public_phone || "",
    public_email: organization.public_email || "",
    website_url: organization.website_url || organization.website || "",
    facebook_url: organization.facebook_url || "",
    instagram_url: organization.instagram_url || "",
    linkedin_url: organization.linkedin_url || "",
  };
}

export default function ProviderProfilePublic({ locationId, overview, workspace, onNavigate, onSelectLocation, onRefresh }) {
  const organization = overview.organization || workspace?.organizations?.[0] || {};
  const overviewLocation = overview.location || {};
  const locations = workspace?.locations || overview.locations || [];
  const location = locations.find((item) => item.id === locationId) || (overviewLocation.id ? overviewLocation : null) || locations[0] || {};
  const organizationId = organization.id || location.organization_id || workspace?.organizations?.[0]?.id || "";
  const organizationName = organization.public_display_name || organization.name || location.organization_name || location.name || "Organizație";
  const locationCount = locations.length || 1;
  const profileTypeLabel = PROVIDER_PROFILE_TYPES[organization.organization_type] || PROVIDER_PROFILE_TYPES[location.provider_profile_type] || PROVIDER_TYPES[location.provider_type] || "Profil";
  const pendingProfile = overview.pending_profile_changes || {};
  const pendingLogoUrl = pendingProfile.pending_logo_url || "";
  const hasPendingLogo = !!pendingProfile.has_pending_logo;
  const canonicalLogo = organization.logo_url || "";
  const profileState = overview.organization_profile_state || {};
  const fallbackValues = profileState.fallback || overview.organization_profile_fallback_values || {};
  const fallbackLocationName = profileState.fallback_location_name || location.public_display_name || location.name || "locația principală";
  const baseValues = useMemo(() => canonicalValues(organization), [organization]);

  const [values, setValues] = useState(baseValues);
  const [logoPreview, setLogoPreview] = useState(pendingLogoUrl || canonicalLogo);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState(hasPendingLogo ? "Logo trimis separat spre verificare." : "");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const pendingReview = draft?.status === "pending_review";
  const canSubmitDraft = Boolean(draft && ["draft", "needs_more_info"].includes(draft.status));
  const descriptionCount = String(values.public_description || "").length;
  const availableFallbackFields = PROFILE_FIELDS.filter((key) => !String(values[key] || "").trim() && String(fallbackValues[key] || "").trim());

  const loadDraft = async () => {
    if (!organizationId) return;
    const response = await base44.functions.invoke("manageProviderOrganizationProfile", { action: "list_mine", organization_id: organizationId, location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const active = (response.data?.submissions || []).find((submission) => ["draft", "needs_more_info", "pending_review"].includes(submission.status));
    setDraft(active || null);
    if (active) {
      try { setValues({ ...baseValues, ...JSON.parse(active.payload_json || "{}") }); } catch (_error) { setValues(baseValues); }
    } else {
      setValues(baseValues);
    }
  };

  useEffect(() => {
    setValues(baseValues);
    setLogoPreview(pendingLogoUrl || canonicalLogo);
    setLogoMessage(hasPendingLogo ? "Logo trimis separat spre verificare." : "");
  }, [baseValues, pendingLogoUrl, canonicalLogo, hasPendingLogo]);

  useEffect(() => { loadDraft(); }, [organizationId, locationId]);

  const setField = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const importFallback = () => {
    setValues((current) => {
      const next = { ...current };
      for (const key of PROFILE_FIELDS) if (!String(next[key] || "").trim() && String(fallbackValues[key] || "").trim()) next[key] = fallbackValues[key];
      return next;
    });
    setMessage(`Datele din ${fallbackLocationName} au fost preluate în formular, dar nu sunt încă salvate. Salvează draftul și trimite-l spre verificare.`);
  };

  const saveDraft = async () => {
    setSaving(true);
    setMessage("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const response = await base44.functions.invoke("manageProviderOrganizationProfile", {
      action,
      organization_id: organizationId,
      location_id: locationId,
      submission_id: draft?.id,
      payload: { ...values, public_description: String(values.public_description || "").slice(0, DESCRIPTION_MAX_LENGTH) },
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu există modificări noi de salvat.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Această modificare este deja în verificare.");
    else if (data.resumed || data.unchanged) setMessage(data.message || "Draftul existent a fost încărcat.");
    else setMessage("Draft salvat. În acest moment apare în Prezentare generală la Necesită acțiune, dar nu intră în administrare până nu îl trimiți spre verificare.");
    await loadDraft();
    await onRefresh?.();
  };

  const submitDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    const response = await base44.functions.invoke("manageProviderOrganizationProfile", { action: "submit", organization_id: organizationId, location_id: locationId, submission_id: draft.id }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu există modificări noi de trimis.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Această modificare este deja în verificare.");
    else setMessage("Profilul organizației a fost trimis spre verificare. Acum apare și în administrare la Modificări workspace.");
    await loadDraft();
    await onRefresh?.();
  };

  const uploadLogo = async (file) => {
    setLogoMessage("");
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) { setLogoMessage("Format acceptat: PNG, JPG sau WEBP."); return; }
    if (file.size > LOGO_MAX_BYTES) { setLogoMessage("Logo-ul trebuie să aibă maximum 4 MB înainte de optimizare."); return; }
    setUploadingLogo(true);
    let localPreviewUrl = "";
    try {
      const optimizedFile = await makeSafeLogoFile(file, organizationId);
      localPreviewUrl = URL.createObjectURL(optimizedFile);
      setLogoPreview(localPreviewUrl);
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: optimizedFile });
      const logoUrl = String(uploadResponse?.file_url || "").trim();
      if (!logoUrl) throw new Error("Încărcarea logo-ului nu a returnat un URL valid.");
      const response = await base44.functions.invoke("submitProviderLogoForReview", { location_id: locationId, organization_id: organizationId, photo_url: logoUrl }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
      if (response.data?.error) throw new Error(response.data.error);
      setLogoPreview(logoUrl);
      setLogoMessage("Logo trimis separat spre verificare. Va apărea lângă numele organizației după aprobare.");
      await onRefresh?.();
    } catch (error) {
      setLogoPreview(pendingLogoUrl || canonicalLogo);
      setLogoMessage(error.message || "Nu am putut încărca logo-ul.");
    } finally {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      setUploadingLogo(false);
    }
  };

  const manageLocation = (id) => {
    if (id && onSelectLocation) onSelectLocation(id);
    onNavigate?.("locations");
  };

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 border-b border-[#171717]/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#345bc8]"><span className="h-2 w-2 bg-[#345bc8]" /> Identitate publică · organizație</div>
          <h1 className="mt-3 max-w-3xl font-heading text-[2.1rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#171717] sm:text-[2.5rem]">Profilul pe care îl văd clienții tăi.</h1>
          <p className="mt-2.5 max-w-3xl text-base leading-[1.65] text-[#615e57]">Configurează identitatea brandului. Adresa, programul, contactul local și fotografiile se gestionează separat pentru fiecare locație.</p>
        </div>
        {draft && <span className="w-fit shrink-0 rounded-full border border-[#171717]/10 bg-white px-3.5 py-2 text-[13px] font-semibold text-[#5d5a54]">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px] xl:items-start">
        <div className="space-y-5">
          {availableFallbackFields.length > 0 && !pendingReview && (
            <section className="rounded-[18px] border border-[#a97825]/25 bg-[#f5ead0] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a97825] text-white"><AlertTriangle className="h-4 w-4" /></div>
                  <div>
                    <h2 className="text-base font-bold text-[#5f4317]">Există date în {fallbackLocationName}, dar nu sunt salvate pe organizație</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#76551f]">{availableFallbackFields.map((key) => FIELD_LABELS[key]).join(", ")}. Preluarea completează doar formularul. Datele ajung în verificare numai după salvare și trimitere.</p>
                  </div>
                </div>
                <button type="button" onClick={importFallback} className="min-h-11 shrink-0 rounded-full bg-[#171717] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-85">Preia datele în formular</button>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-[18px] border border-[#171717]/12 bg-white shadow-[0_12px_32px_rgba(23,23,23,0.04)]">
            <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#345bc8]">01</span>
                <span className="h-4 w-px bg-[#171717]/20" />
                <span className="font-heading text-base font-bold text-[#2d2b27]">Identitate</span>
                <div className="ml-2 h-px flex-1 bg-[#171717]/12" />
              </div>

              <div className="rounded-[16px] border border-[#171717]/10 bg-[#f8f4ec]/70 p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <label className="relative block shrink-0 cursor-pointer" title={logoPreview ? "Schimbă logo-ul" : "Adaugă logo"}>
                      <BrandLogo name={values.public_display_name || organizationName} photoUrl={logoPreview} pending={hasPendingLogo} small />
                      <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f8f4ec] bg-[#171717] text-white shadow-sm">{uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={(event) => { uploadLogo(event.target.files?.[0]); event.target.value = ""; }} />
                    </label>
                    <div className="min-w-0">
                      <div className="text-base font-semibold">Logo organizație</div>
                      <p className="mt-1 text-sm leading-relaxed text-[#69655d]">Apare lângă numele organizației, separat de fotografiile locațiilor.</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#171717]/10 bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#69655d]"><ImagePlus className="h-3.5 w-3.5" /> Publicare după aprobare</div>
                </div>
                {logoMessage && <p className="mt-3 border-t border-[#171717]/10 pt-3 text-sm leading-relaxed text-[#69655d]">{logoMessage}</p>}
              </div>

              <Field label="Nume public organizație" hint="Exemplu: Lunera Optic. Numele locației poate fi diferit."><input className={inputCls} value={values.public_display_name} disabled={pendingReview} onChange={(event) => setField("public_display_name", event.target.value)} /></Field>
              <Field label="Descriere organizație" hint="Prezintă pe scurt ce oferiți, cui vă adresați și ce diferențiază brandul.">
                <textarea className={`${inputCls} min-h-32 resize-y`} value={values.public_description} maxLength={DESCRIPTION_MAX_LENGTH} disabled={pendingReview} onChange={(event) => setField("public_description", event.target.value)} />
                <div className="mt-1.5 text-right text-xs text-muted-foreground">{descriptionCount}/{DESCRIPTION_MAX_LENGTH}</div>
              </Field>
            </div>

            <div className="border-t border-[#171717]/10 px-5 py-5 sm:px-6 sm:py-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#345bc8]">02</span>
                <span className="h-4 w-px bg-[#171717]/20" />
                <span className="font-heading text-base font-bold text-[#2d2b27]">Contact public</span>
                <div className="ml-2 h-px flex-1 bg-[#171717]/12" />
              </div>
              <div className="grid gap-3.5 md:grid-cols-2">
                <Field label="Telefon general" hint="Telefonul general al organizației."><input className={inputCls} value={values.public_phone} disabled={pendingReview} onChange={(event) => setField("public_phone", event.target.value)} /></Field>
                <Field label="Email general" hint="Adresa generală pentru contact."><input className={inputCls} value={values.public_email} disabled={pendingReview} onChange={(event) => setField("public_email", event.target.value)} /></Field>
                <div className="md:col-span-2"><Field label="Website" hint="Link către site-ul organizației."><input className={inputCls} value={values.website_url} disabled={pendingReview} onChange={(event) => setField("website_url", event.target.value)} /></Field></div>
              </div>
            </div>

            <div className="border-t border-[#171717]/10 px-5 py-5 sm:px-6 sm:py-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#345bc8]">03</span>
                <span className="h-4 w-px bg-[#171717]/20" />
                <span className="font-heading text-base font-bold text-[#2d2b27]">Canale online</span>
                <div className="ml-2 h-px flex-1 bg-[#171717]/12" />
              </div>
              <div className="grid gap-3.5 md:grid-cols-2">
                <Field label="Facebook" hint="Link către pagina oficială."><input className={inputCls} value={values.facebook_url} disabled={pendingReview} onChange={(event) => setField("facebook_url", event.target.value)} /></Field>
                <Field label="Instagram" hint="Link către profilul oficial."><input className={inputCls} value={values.instagram_url} disabled={pendingReview} onChange={(event) => setField("instagram_url", event.target.value)} /></Field>
                <div className="md:col-span-2"><Field label="LinkedIn" hint="Opțional, util mai ales pentru comunicarea profesională."><input className={inputCls} value={values.linkedin_url} disabled={pendingReview} onChange={(event) => setField("linkedin_url", event.target.value)} /></Field></div>
              </div>
            </div>

          </section>

          <div className="sticky bottom-3 z-20 rounded-[16px] border border-[#171717]/12 bg-[#f8f4ec]/95 px-4 py-3 shadow-[0_10px_28px_rgba(23,23,23,0.1)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5 text-sm leading-relaxed text-[#5f5b54]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5d5a54]" /><span>Aprobarea actualizează doar informațiile organizației. Datele locației rămân separate.</span></div>
              <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
                <button type="button" disabled={saving || pendingReview} onClick={saveDraft} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${canSubmitDraft ? "border-[#171717]/20 bg-white text-[#171717] hover:bg-[#f8f4ec]" : "border-[#171717] bg-[#171717] text-white hover:bg-[#2a2a2a]"}`}><Save className="h-4 w-4" /> Salvează draftul</button>
                {canSubmitDraft && <button type="button" disabled={saving} onClick={submitDraft} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#171717] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"><Send className="h-4 w-4" /> Trimite spre verificare</button>}
              </div>
            </div>
            {message && <p className="mt-3 border-t border-[#171717]/10 pt-3 text-sm leading-relaxed text-[#69655d]">{message}</p>}
          </div>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4">
          <div className="flex items-center gap-3 px-1">
            <span className="text-[13px] font-semibold text-[#706c64]">Previzualizare în timp real</span>
            <div className="h-px flex-1 bg-[#171717]/15" />
          </div>
          <OrganizationPreview organizationName={organizationName} profileTypeLabel={profileTypeLabel} verified={location.profile_control_status === "verified"} values={values} logoPreview={logoPreview} hasPendingLogo={hasPendingLogo} locationCount={locationCount} location={location} onManageLocation={manageLocation} />
        </aside>
      </div>
    </div>
  );
}
