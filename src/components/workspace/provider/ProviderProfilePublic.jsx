import React, { useEffect, useMemo, useState } from "react";
import {
  Globe2,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
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

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/50 disabled:cursor-not-allowed disabled:opacity-60";
const DESCRIPTION_MAX_LENGTH = 500;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 4 * 1024 * 1024;
const LOGO_MAX_OPTIMIZED_BYTES = 1024 * 1024;
const ACTIVE_PHOTO_STATUSES = ["draft", "pending_review", "needs_more_info"];

const SOCIAL_ITEMS = [
  { key: "facebook_url", label: "Facebook", platform: "facebook" },
  { key: "instagram_url", label: "Instagram", platform: "instagram" },
  { key: "linkedin_url", label: "LinkedIn", platform: "linkedin" },
];

const REVIEW_FIELDS = [
  ["public_phone", "Telefon general", "Telefon general al organizatiei.", "+40..."],
  ["public_email", "Email general", "Email general pentru contact.", "contact@firma.ro"],
  ["website_url", "Website", "Link catre site-ul organizatiei.", "opticata.ro"],
  ["facebook_url", "Facebook", "Link catre pagina oficiala.", "facebook.com/opticata"],
  ["instagram_url", "Instagram", "Link catre profilul oficial.", "instagram.com/opticata"],
  ["linkedin_url", "LinkedIn", "Optional, util mai ales pentru B2B.", "linkedin.com/company/opticata"],
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
      reject(new Error("Imaginea nu poate fi citita."));
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
  if (blob.size > LOGO_MAX_OPTIMIZED_BYTES) {
    throw new Error("Logo-ul este prea mare dupa optimizare. Incearca o imagine mai simpla.");
  }
  return new File(
    [blob],
    `organization-${organizationId || "logo"}-${Date.now()}.${extension}`,
    { type, lastModified: Date.now() },
  );
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
  const sizeClass = small ? "h-14 w-14 rounded-2xl" : "h-16 w-16 rounded-3xl";
  return (
    <div className={`relative shrink-0 overflow-hidden border border-white/70 bg-white shadow-sm ${sizeClass}`}>
      {photoUrl ? (
        <img src={photoUrl} alt={`Logo ${name}`} className="h-full w-full object-contain p-2" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-foreground font-heading text-lg font-black text-background">
          {initials(name)}
        </div>
      )}
      {pending && <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[9px] font-bold text-white">review</div>}
    </div>
  );
}

function PreviewMetric({ icon: Icon, label, value, muted }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 truncate text-xs font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function SocialPill({ item, url }) {
  const safeUrl = normalizeClientUrl(url);
  if (!safeUrl) return null;
  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm hover:bg-white"
      title={displayUrl(url)}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
        <SocialBrandIcon platform={item.platform} className="h-3.5 w-3.5" />
      </span>
      {item.label}
    </a>
  );
}

function OrganizationPreview({ organizationName, profileTypeLabel, verified, values, logoPreview, hasPendingLogo, locationCount }) {
  const socialItems = SOCIAL_ITEMS.filter((item) => normalizeClientUrl(values[item.key]));
  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
      <div className="relative p-5" style={{ background: "linear-gradient(135deg, #fffaf2 0%, #ffffff 46%, #f4f1ea 100%)" }}>
        <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-amber-100/60" />
        <div className="relative flex gap-4">
          <BrandLogo name={organizationName} photoUrl={logoPreview} pending={hasPendingLogo} />
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">Previzualizare organizatie</div>
            <h2 className="mt-1 truncate font-heading text-2xl font-extrabold tracking-tight">
              {values.public_display_name || organizationName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold shadow-sm">{profileTypeLabel}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${verified ? "bg-green-100 text-green-800" : "bg-white/80 text-foreground"}`}>
                <ShieldCheck className="h-3.5 w-3.5" /> {verified ? "Verificat" : "Activ"}
              </span>
              {hasPendingLogo && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 shadow-sm">Logo in review</span>}
            </div>
          </div>
        </div>
        <p className="relative mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
          {values.public_description || "Adauga o descriere generala pentru organizatie. Datele punctelor de lucru se gestioneaza separat."}
        </p>
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <PreviewMetric icon={Store} label="Locatii" value={`${locationCount} ${locationCount === 1 ? "locatie" : "locatii"}`} />
          <PreviewMetric icon={Phone} label="Telefon" value={values.public_phone || "Lipseste"} muted={!values.public_phone} />
          <PreviewMetric icon={Mail} label="Email" value={values.public_email || "Lipseste"} muted={!values.public_email} />
          <PreviewMetric icon={Globe2} label="Website" value={displayUrl(values.website_url) || "Nepublicat"} muted={!values.website_url} />
        </div>
        {socialItems.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {socialItems.map((item) => <SocialPill key={item.key} item={item} url={values[item.key]} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function LocationSummaryCard({ organizationName, logoPreview, location, locations, onManageLocation, onManageAll }) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoStatus, setPhotoStatus] = useState("");
  const [photoLoading, setPhotoLoading] = useState(true);

  const locationName = location?.public_display_name || location?.name || "Locatie";
  const locality = location?.locality_name || location?.city || "Localitate necompletata";
  const otherLocations = (locations || []).filter((item) => item.id && item.id !== location?.id);
  const inactive = location?.active_status === "inactiva";

  useEffect(() => {
    let cancelled = false;

    async function loadPhoto() {
      if (!location?.id) {
        setPhotoUrl("");
        setPhotoStatus("");
        setPhotoLoading(false);
        return;
      }

      setPhotoLoading(true);
      const response = await base44.functions.invoke("locationPhotoOps", {
        action: "get",
        location_id: location.id,
      }).catch(() => ({ data: {} }));

      if (cancelled) return;

      const submission = response.data?.submission || null;
      const hasActivePreview = ACTIVE_PHOTO_STATUSES.includes(submission?.status);
      const proposedPhoto = hasActivePreview
        ? String(submission?.payload?.photo_url || submission?.payload?.photo_data_url || "")
        : "";
      const approvedPhoto = response.data?.legacy_logo_candidate === true
        ? ""
        : String(response.data?.location?.current_photo_url || "");

      setPhotoUrl(proposedPhoto || approvedPhoto);
      setPhotoStatus(hasActivePreview ? submission.status : "");
      setPhotoLoading(false);
    }

    loadPhoto();
    return () => { cancelled = true; };
  }, [location?.id]);

  const photoStatusLabel = {
    draft: "Draft fotografie",
    pending_review: "Fotografie in verificare",
    needs_more_info: "Necesita completari",
  }[photoStatus] || "";

  return (
    <section className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo name={organizationName} photoUrl={logoPreview} small />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Punct de lucru</div>
            <div className="truncate text-sm font-bold">{locationName}</div>
            <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {locality}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${inactive ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {inactive ? "Inactiva" : "Activa"}
          </span>
          <button
            type="button"
            onClick={() => onManageLocation(location?.id)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            Gestioneaza
          </button>
        </div>
      </div>

      <div className="relative aspect-video border-y border-border bg-secondary/35">
        {photoLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca fotografia...
          </div>
        ) : photoUrl ? (
          <>
            <img src={photoUrl} alt={`Fotografie ${locationName}`} className="h-full w-full object-cover" />
            {photoStatusLabel && (
              <span className="absolute bottom-3 left-3 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[10px] font-bold text-amber-900 shadow-sm backdrop-blur-sm">
                {photoStatusLabel}
              </span>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center text-muted-foreground">
            <ImagePlus className="h-7 w-7" />
            <p className="mt-2 text-xs font-semibold">Fotografia locatiei se adauga din Locatii</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 text-[11px] text-muted-foreground">
        <span>{locations.length || 1} {locations.length === 1 ? "punct de lucru asociat" : "puncte de lucru asociate"}</span>
        <span>Logo organizatie + fotografie locatie</span>
      </div>

      {otherLocations.length > 0 && (
        <div className="border-t border-border">
          {otherLocations.slice(0, 3).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onManageLocation(item.id)}
              className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left last:border-b-0 hover:bg-secondary/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary"><MapPin className="h-3.5 w-3.5" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{item.public_display_name || item.name || "Locatie"}</div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.locality_name || item.city || "Localitate lipsa"}</div>
              </div>
            </button>
          ))}
          {otherLocations.length > 3 && (
            <button type="button" onClick={onManageAll} className="w-full px-4 py-3 text-xs font-semibold hover:bg-secondary/30">
              Vezi toate cele {locations.length} locatii
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function initialValues(organization, publicPreview) {
  return {
    public_display_name: organization.public_display_name || publicPreview.display_name || organization.name || "",
    public_description: String(organization.public_description || publicPreview.description || "").slice(0, DESCRIPTION_MAX_LENGTH),
    public_phone: organization.public_phone || publicPreview.phone || "",
    public_email: organization.public_email || publicPreview.email || "",
    website_url: organization.website_url || publicPreview.website || "",
    facebook_url: organization.facebook_url || publicPreview.facebook || "",
    instagram_url: organization.instagram_url || publicPreview.instagram || "",
    linkedin_url: organization.linkedin_url || publicPreview.linkedin || "",
  };
}

export default function ProviderProfilePublic({ locationId, overview, workspace, onNavigate, onSelectLocation, onRefresh }) {
  const organization = overview.organization || workspace?.organizations?.[0] || {};
  const publicPreview = overview.public_preview || {};
  const overviewLocation = overview.location || {};
  const locations = workspace?.locations || overview.locations || [];
  const location = locations.find((item) => item.id === locationId)
    || (overviewLocation.id ? overviewLocation : null)
    || locations[0]
    || {};
  const organizationId = organization.id || location.organization_id || workspace?.organizations?.[0]?.id || "";
  const organizationName = organization.public_display_name
    || organization.name
    || location.organization_name
    || publicPreview.display_name
    || location.name
    || "Organizatie";
  const locationCount = locations.length || 1;
  const profileTypeLabel = PROVIDER_PROFILE_TYPES[organization.organization_type]
    || PROVIDER_PROFILE_TYPES[location.provider_profile_type]
    || PROVIDER_TYPES[location.provider_type]
    || "Profil";
  const pendingProfile = overview.pending_profile_changes || {};
  const pendingLogoUrl = pendingProfile.pending_logo_url || "";
  const hasPendingLogo = !!pendingProfile.has_pending_logo;
  const canonicalLogo = organization.logo_url || "";

  const baseValues = useMemo(() => initialValues(organization, publicPreview), [organization, publicPreview]);
  const [values, setValues] = useState(baseValues);
  const [logoPreview, setLogoPreview] = useState(pendingLogoUrl || canonicalLogo);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState(hasPendingLogo ? "Logo trimis separat spre verificare." : "");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const pendingReview = draft?.status === "pending_review";
  const descriptionCount = String(values.public_description || "").length;

  const loadDraft = async () => {
    if (!organizationId) return;
    const response = await base44.functions.invoke("manageProviderOrganizationProfile", {
      action: "list_mine",
      organization_id: organizationId,
      location_id: locationId,
    }).catch(() => ({ data: { submissions: [] } }));
    const active = (response.data?.submissions || []).find((submission) => ["draft", "needs_more_info", "pending_review"].includes(submission.status));
    setDraft(active || null);
    if (active) {
      try {
        setValues({ ...baseValues, ...JSON.parse(active.payload_json || "{}") });
      } catch (_error) {
        setValues(baseValues);
      }
    } else {
      setValues(baseValues);
    }
  };

  useEffect(() => {
    setValues(baseValues);
    setLogoPreview(pendingLogoUrl || canonicalLogo);
    setLogoMessage(hasPendingLogo ? "Logo trimis separat spre verificare." : "");
  }, [baseValues, pendingLogoUrl, canonicalLogo, hasPendingLogo]);

  useEffect(() => {
    loadDraft();
  }, [organizationId, locationId]);

  const setField = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const saveDraft = async () => {
    setSaving(true);
    setMessage("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const response = await base44.functions.invoke("manageProviderOrganizationProfile", {
      action,
      organization_id: organizationId,
      location_id: locationId,
      submission_id: draft?.id,
      payload: {
        ...values,
        public_description: String(values.public_description || "").slice(0, DESCRIPTION_MAX_LENGTH),
      },
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      return;
    }
    setMessage("Draft salvat. Trimite-l spre review cand este pregatit.");
    await loadDraft();
  };

  const submitDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    const response = await base44.functions.invoke("manageProviderOrganizationProfile", {
      action: "submit",
      organization_id: organizationId,
      location_id: locationId,
      submission_id: draft.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      return;
    }
    setMessage("Profilul organizatiei a fost trimis spre review.");
    await loadDraft();
    await onRefresh?.();
  };

  const uploadLogo = async (file) => {
    setLogoMessage("");
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoMessage("Format acceptat: PNG, JPG sau WEBP.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoMessage("Logo-ul trebuie sa aiba maximum 4MB inainte de optimizare.");
      return;
    }

    setUploadingLogo(true);
    let localPreviewUrl = "";
    try {
      const optimizedFile = await makeSafeLogoFile(file, organizationId);
      localPreviewUrl = URL.createObjectURL(optimizedFile);
      setLogoPreview(localPreviewUrl);
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: optimizedFile });
      const logoUrl = String(uploadResponse?.file_url || "").trim();
      if (!logoUrl) throw new Error("Incarcarea logo-ului nu a returnat un URL valid.");
      const response = await base44.functions.invoke("submitProviderLogoForReview", {
        location_id: locationId,
        organization_id: organizationId,
        photo_url: logoUrl,
      }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
      if (response.data?.error) throw new Error(response.data.error);
      setLogoPreview(logoUrl);
      setLogoMessage("Logo trimis separat spre verificare. Va aparea langa numele organizatiei dupa aprobare.");
      await onRefresh?.();
    } catch (error) {
      setLogoPreview(pendingLogoUrl || canonicalLogo);
      setLogoMessage(error.message || "Nu am putut incarca logo-ul.");
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
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public organizatie</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Date generale de brand. Logo-ul apare langa numele organizatiei. Fotografiile reale se gestioneaza separat pentru fiecare locatie.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_390px] xl:items-start">
        <div className="space-y-5">
          <section className="space-y-5 rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Informatii publice generale</h2>
                <p className="mt-1 text-xs text-muted-foreground">Modificarile actualizeaza ProviderOrganization numai dupa aprobarea Vezunde.</p>
              </div>
              {draft && (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                  {SUBMISSION_STATUS_LABELS[draft.status] || draft.status}
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-secondary/35 p-4">
              <div className="flex items-center gap-3">
                <label className="relative block shrink-0 cursor-pointer" title={logoPreview ? "Schimba logo" : "Adauga logo"}>
                  <BrandLogo name={values.public_display_name || organizationName} photoUrl={logoPreview} pending={hasPendingLogo} small />
                  <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-foreground text-background shadow-sm">
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(event) => {
                      uploadLogo(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Logo organizatie</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Acesta este afisat langa numele organizatiei. Nu este folosit ca fotografie a locatiei.</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    <ImagePlus className="h-3.5 w-3.5" /> Publicare dupa aprobare
                  </div>
                </div>
              </div>
              {logoMessage && (
                <p className={`mt-3 text-xs ${hasPendingLogo || logoMessage.includes("verificare") ? "text-amber-700" : "text-muted-foreground"}`}>
                  {logoMessage}
                </p>
              )}
            </div>

            <Field label="Nume public organizatie" hint="Exemplu: Lunera Optic">
              <input
                className={inputCls}
                value={values.public_display_name || ""}
                onChange={(event) => setField("public_display_name", event.target.value)}
                disabled={pendingReview}
              />
            </Field>

            <Field label="Descriere organizatie">
              <textarea
                className={inputCls}
                rows={7}
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={values.public_description || ""}
                onChange={(event) => setField("public_description", event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                disabled={pendingReview}
              />
              <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] leading-relaxed text-muted-foreground">
                <p>Prezentare generala a brandului: ce oferiti, cui va adresati si ce va diferentiaza.</p>
                <span className="shrink-0 font-semibold">{descriptionCount}/{DESCRIPTION_MAX_LENGTH}</span>
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              {REVIEW_FIELDS.map(([key, label, hint, placeholder]) => (
                <Field key={key} label={label} hint={hint}>
                  <input
                    className={inputCls}
                    placeholder={placeholder}
                    value={values[key] || ""}
                    onChange={(event) => setField(key, event.target.value)}
                    disabled={pendingReview}
                  />
                </Field>
              ))}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
              Datele punctelor de lucru nu se editeaza aici. Foloseste pagina Locatii pentru adresa, harta, telefon local, program, servicii, fotografii si specialisti.
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                disabled={saving || pendingReview || !organizationId}
                onClick={saveDraft}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Salveaza draft
              </button>
              {draft && draft.status !== "pending_review" && (
                <button
                  disabled={saving}
                  onClick={submitDraft}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Trimite spre review
                </button>
              )}
              {message && <p className="text-xs text-muted-foreground">{message}</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <OrganizationPreview
            organizationName={organizationName}
            profileTypeLabel={profileTypeLabel}
            verified={location.profile_control_status === "verified"}
            values={values}
            logoPreview={logoPreview}
            hasPendingLogo={hasPendingLogo}
            locationCount={locationCount}
          />

          <LocationSummaryCard
            organizationName={values.public_display_name || organizationName}
            logoPreview={logoPreview}
            location={location}
            locations={locations.length ? locations : [location]}
            onManageLocation={manageLocation}
            onManageAll={() => onNavigate?.("locations")}
          />
        </aside>
      </div>
    </div>
  );
}
