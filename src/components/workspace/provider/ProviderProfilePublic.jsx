import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Globe2,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";
import SocialBrandIcon from "@/components/common/SocialBrandIcon";

const inputCls =
  "min-h-12 w-full rounded-[14px] border border-[#d9d4ca] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#171717] outline-none transition-[border-color,box-shadow] focus:border-[#345bc8] focus:ring-4 focus:ring-[#345bc8]/10 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]";
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
  public_display_name: "Nume public organizatie",
  public_description: "Descriere organizatie",
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
  return (
    String(name || "V")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "V"
  );
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
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname.includes(".")
    ) {
      return "";
    }
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
    throw new Error(
      "Logo-ul este prea mare dupa optimizare. Incearca o imagine mai simpla.",
    );
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
      <label className="text-sm font-semibold text-[#2d2b27]">{label}</label>
      <div className="mt-2">{children}</div>
      {hint && (
        <p className="mt-2 text-[13px] leading-relaxed text-[#706c64]">
          {hint}
        </p>
      )}
    </div>
  );
}

function BrandLogo({ name, photoUrl, pending, className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [photoUrl]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[22px] border-4 border-white bg-white shadow-[0_12px_28px_rgba(23,23,23,0.13)] ${className}`}
    >
      {photoUrl && !imageFailed ? (
        <img
          src={photoUrl}
          alt={`Logo ${name}`}
          className="h-full w-full object-contain p-3"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#171717] font-heading text-2xl font-black text-[#f8f4ec]">
          {initials(name)}
        </div>
      )}
      {pending && (
        <div className="absolute inset-x-0 bottom-0 bg-amber-500/95 py-1 text-center text-[10px] font-bold text-white">
          in verificare
        </div>
      )}
    </div>
  );
}

function EditableLogo({
  name,
  logoPreview,
  hasPendingLogo,
  uploadingLogo,
  onLogoChange,
}) {
  return (
    <label
      className="group relative block w-fit shrink-0 cursor-pointer"
      title={logoPreview ? "Schimba logo-ul" : "Adauga logo"}
    >
      <BrandLogo
        name={name}
        photoUrl={logoPreview}
        pending={hasPendingLogo}
        className="h-28 w-28 sm:h-32 sm:w-32"
      />
      <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[#f8f4ec] bg-[#171717] text-white shadow-md transition-transform group-hover:scale-105">
        {uploadingLogo ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={uploadingLogo}
        onChange={(event) => {
          onLogoChange(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function ProfileInfo({ icon: Icon, label, value, muted }) {
  return (
    <div className="min-w-0 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#77736b]">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <div
        className={`mt-1 truncate text-sm font-semibold ${
          muted ? "text-[#9a968f]" : "text-[#171717]"
        }`}
        title={value}
      >
        {value}
      </div>
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
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#171717]/12 bg-transparent px-3.5 text-[13px] font-semibold text-[#171717] transition-colors hover:bg-white"
      title={displayUrl(url)}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#171717] text-[#f8f4ec]">
        <SocialBrandIcon platform={item.platform} className="h-3.5 w-3.5" />
      </span>
      {item.label}
    </a>
  );
}

function InlineProfileEditor({
  values,
  setField,
  descriptionCount,
  pendingReview,
  availableFallbackFields,
  fallbackLocationName,
  importFallback,
  logoMessage,
  message,
}) {
  return (
    <div className="mt-7 rounded-[22px] border border-[#171717]/10 bg-white p-5 shadow-[0_12px_32px_rgba(23,23,23,0.05)] sm:p-7">
      <div className="mb-6 flex items-start gap-3 border-b border-[#171717]/10 pb-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9eef8] text-[#345bc8]">
          <Pencil className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-bold text-[#171717]">
            Editezi profilul public
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#706c64]">
            Completeaza datele generale ale organizatiei. Modificarile sunt
            publicate dupa aprobare.
          </p>
        </div>
      </div>

      {availableFallbackFields.length > 0 && !pendingReview && (
        <div className="mb-6 rounded-[16px] border border-[#a97825]/25 bg-[#f5ead0] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#76551f]" />
              <p className="text-sm leading-relaxed text-[#76551f]">
                Exista date in {fallbackLocationName} pentru:{" "}
                {availableFallbackFields
                  .map((key) => FIELD_LABELS[key])
                  .join(", ")}.
              </p>
            </div>
            <button
              type="button"
              onClick={importFallback}
              className="min-h-10 w-full shrink-0 rounded-full bg-[#171717] px-4 text-sm font-semibold text-white sm:w-auto"
            >
              Preia datele
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-5">
          <div>
            <div className="text-sm font-bold text-[#171717]">Identitate</div>
            <p className="mt-1 text-xs text-[#77736b]">
              Numele si descrierea generala a organizatiei.
            </p>
          </div>
          <Field
            label="Nume public organizatie"
            hint="Numele locatiei poate fi diferit."
          >
            <input
              className={inputCls}
              value={values.public_display_name}
              disabled={pendingReview}
              onChange={(event) =>
                setField("public_display_name", event.target.value)
              }
            />
          </Field>
          <Field label="Descriere organizatie">
            <textarea
              className={`${inputCls} min-h-44 resize-y`}
              value={values.public_description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              disabled={pendingReview}
              onChange={(event) =>
                setField("public_description", event.target.value)
              }
            />
            <div className="mt-1.5 text-right text-xs text-muted-foreground">
              {descriptionCount}/{DESCRIPTION_MAX_LENGTH}
            </div>
          </Field>
        </div>

        <div className="space-y-7">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-bold text-[#171717]">
                Contact public
              </div>
              <p className="mt-1 text-xs text-[#77736b]">
                Date generale, separate de contactul fiecarei locatii.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Telefon">
                <input
                  type="tel"
                  className={inputCls}
                  value={values.public_phone}
                  disabled={pendingReview}
                  onChange={(event) =>
                    setField("public_phone", event.target.value)
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  value={values.public_email}
                  disabled={pendingReview}
                  onChange={(event) =>
                    setField("public_email", event.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="Website">
              <input
                type="url"
                className={inputCls}
                value={values.website_url}
                disabled={pendingReview}
                onChange={(event) =>
                  setField("website_url", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="space-y-4 border-t border-[#171717]/10 pt-6">
            <div>
              <div className="text-sm font-bold text-[#171717]">
                Canale online
              </div>
              <p className="mt-1 text-xs text-[#77736b]">
                Linkurile oficiale afisate in profil.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Facebook">
                <input
                  type="url"
                  className={inputCls}
                  value={values.facebook_url}
                  disabled={pendingReview}
                  onChange={(event) =>
                    setField("facebook_url", event.target.value)
                  }
                />
              </Field>
              <Field label="Instagram">
                <input
                  type="url"
                  className={inputCls}
                  value={values.instagram_url}
                  disabled={pendingReview}
                  onChange={(event) =>
                    setField("instagram_url", event.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="LinkedIn">
              <input
                type="url"
                className={inputCls}
                value={values.linkedin_url}
                disabled={pendingReview}
                onChange={(event) =>
                  setField("linkedin_url", event.target.value)
                }
              />
            </Field>
          </div>
        </div>
      </div>

      {(logoMessage || message) && (
        <div className="mt-6 space-y-2 rounded-[14px] border border-[#171717]/10 bg-[#fbfaf7] px-4 py-3 text-sm leading-relaxed text-[#69655d]">
          {logoMessage && (
            <p className="flex items-start gap-2">
              <ImagePlus className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{logoMessage}</span>
            </p>
          )}
          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  );
}

function OrganizationProfile({
  organizationName,
  profileTypeLabel,
  verified,
  values,
  setField,
  logoPreview,
  hasPendingLogo,
  uploadingLogo,
  onLogoChange,
  locationCount,
  draft,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  pendingReview,
  descriptionCount,
  availableFallbackFields,
  fallbackLocationName,
  importFallback,
  logoMessage,
  message,
}) {
  const socialItems = SOCIAL_ITEMS.filter((item) =>
    normalizeClientUrl(values[item.key]),
  );
  const displayName = values.public_display_name || organizationName;

  return (
    <section>
      <div
        className="relative h-36 overflow-hidden rounded-[22px] border border-[#171717]/10 sm:h-44 lg:h-48"
        style={{
          background:
            "linear-gradient(180deg, #DCE4F2 0%, #E9ECF4 30%, #F5F3EE 72%, #F7F2E8 100%)",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(23,23,23,0.13) 1px, transparent 1.2px)",
            backgroundSize: "22px 22px",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute -right-16 -top-28 h-72 w-72 rounded-full border border-white/50"
        />
        <span
          aria-hidden="true"
          className="absolute -right-3 -top-14 h-44 w-44 rounded-full border border-white/40"
        />
        <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#4e4b46] backdrop-blur-sm sm:left-7 sm:top-6">
          <span className="h-2 w-2 bg-[#345bc8]" />
          {editing ? "Editare profil" : "Profil public organizatie"}
        </div>
        {draft && (
          <span className="absolute right-5 top-5 rounded-full border border-white/55 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#5d5a54] backdrop-blur-sm sm:right-7 sm:top-6">
            {SUBMISSION_STATUS_LABELS[draft.status] || draft.status}
          </span>
        )}
      </div>

      <div className="relative px-1 sm:px-3">
        <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:gap-6">
          <EditableLogo
            name={displayName}
            logoPreview={logoPreview}
            hasPendingLogo={hasPendingLogo}
            uploadingLogo={uploadingLogo}
            onLogoChange={onLogoChange}
          />

          <div className="min-w-0 flex-1 pb-1 sm:pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#d8ddea] bg-[#f4f6fb] px-3 py-1 text-xs font-semibold text-[#42577d]">
                {profileTypeLabel}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  verified
                    ? "bg-[#dcead8] text-[#315c3a]"
                    : "border border-[#171717]/10 bg-[#f8f4ec] text-[#5d5a54]"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {verified ? "Locatie verificata" : "Profil activ"}
              </span>
            </div>
            <h1 className="mt-3 break-words font-heading text-[2rem] font-extrabold leading-[1.03] tracking-[-0.045em] text-[#171717] sm:text-[2.65rem]">
              {displayName}
            </h1>
            <p className="mt-2 text-sm font-medium text-[#706c64]">
              {locationCount} {locationCount === 1 ? "locatie" : "locatii"} in
              VIASEE
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#171717]/15 bg-transparent px-5 text-sm font-semibold text-[#171717] hover:bg-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Renunta
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || pendingReview}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#171717] px-5 text-sm font-semibold text-white hover:bg-[#2a2a2a] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salveaza
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                disabled={pendingReview}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#171717]/15 bg-transparent px-5 text-sm font-semibold text-[#171717] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" />
                {pendingReview ? "Profil in verificare" : "Editeaza profilul"}
              </button>
            )}
          </div>
        </div>

        {!editing && (
          <div className="mt-7 grid gap-6 border-y border-[#171717]/12 py-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <p className="whitespace-pre-line text-[15px] leading-7 text-[#514e48]">
                {values.public_description ||
                  "Adauga o descriere generala pentru organizatie."}
              </p>
              {socialItems.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {socialItems.map((item) => (
                    <SocialPill
                      key={item.key}
                      item={item}
                      url={values[item.key]}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-x-6 divide-y divide-[#171717]/10 min-[420px]:grid-cols-2 min-[420px]:divide-y-0">
              <ProfileInfo
                icon={Phone}
                label="Telefon"
                value={values.public_phone || "Necompletat"}
                muted={!values.public_phone}
              />
              <ProfileInfo
                icon={Mail}
                label="Email"
                value={values.public_email || "Necompletat"}
                muted={!values.public_email}
              />
              <ProfileInfo
                icon={Globe2}
                label="Website"
                value={displayUrl(values.website_url) || "Nepublicat"}
                muted={!values.website_url}
              />
              <ProfileInfo
                icon={Store}
                label="Organizatie"
                value={displayName}
              />
            </div>
          </div>
        )}

        {editing && (
          <InlineProfileEditor
            values={values}
            setField={setField}
            descriptionCount={descriptionCount}
            pendingReview={pendingReview}
            availableFallbackFields={availableFallbackFields}
            fallbackLocationName={fallbackLocationName}
            importFallback={importFallback}
            logoMessage={logoMessage}
            message={message}
          />
        )}
      </div>
    </section>
  );
}

function locationAddress(location) {
  const parts = [
    location?.address,
    location?.address_line1,
    location?.street_address,
    location?.locality_name,
    location?.city,
    location?.county_name,
    location?.county,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(", ") || "Adresa nu este completata";
}

function LocationRow({ location, selected, onManage }) {
  const name =
    location?.public_display_name || location?.name || "Locatie fara nume";
  const typeLabel =
    PROVIDER_PROFILE_TYPES[location?.provider_profile_type] ||
    PROVIDER_TYPES[location?.provider_type] ||
    "Locatie";
  const photo =
    location?.cover_photo_url ||
    location?.primary_photo_url ||
    location?.image_url ||
    location?.photo_url ||
    "";
  const verified = location?.profile_control_status === "verified";

  return (
    <article className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#171717]/10 bg-[#f8f4ec]">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Building2 className="h-5 w-5 text-[#77736b]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#42577d]">
              {typeLabel}
            </span>
            {verified && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#315c3a]">
                <ShieldCheck className="h-3 w-3" /> Verificata
              </span>
            )}
            {selected && (
              <span className="text-xs font-bold text-[#171717]">Selectata</span>
            )}
          </div>
          <h3 className="mt-1.5 break-words font-heading text-lg font-bold tracking-[-0.02em] text-[#171717]">
            {name}
          </h3>
          <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-[#706c64]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{locationAddress(location)}</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onManage(location?.id)}
        className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-[#171717]/15 bg-transparent px-5 text-sm font-semibold text-[#171717] hover:bg-white sm:w-auto"
      >
        Gestioneaza
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function LocationsSection({ locations, selectedLocationId, onManage, onManageAll }) {
  return (
    <section className="pt-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#345bc8]">
            <Store className="h-4 w-4" /> Gestionare locatii
          </div>
          <h2 className="mt-2 font-heading text-2xl font-extrabold tracking-[-0.035em] text-[#171717]">
            Locatiile organizatiei
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#706c64]">
            Adresa, programul, serviciile, echipa si fotografiile se gestioneaza
            separat pentru fiecare locatie.
          </p>
        </div>
        <button
          type="button"
          onClick={onManageAll}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-[#171717]/15 bg-transparent px-5 text-sm font-semibold text-[#171717] transition-colors hover:bg-white sm:w-auto"
        >
          Gestioneaza toate
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {locations.length > 0 ? (
        <div className="mt-5 divide-y divide-[#171717]/12 border-y border-[#171717]/12">
          {locations.map((item) => (
            <LocationRow
              key={item.id || item.name}
              location={item}
              selected={item.id === selectedLocationId}
              onManage={onManage}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 border-y border-dashed border-[#171717]/15 py-6 text-sm text-[#706c64]">
          Organizatia nu are inca locatii disponibile in workspace.
        </div>
      )}
    </section>
  );
}

function canonicalValues(organization) {
  return {
    public_display_name: organization.public_display_name || "",
    public_description: String(organization.public_description || "").slice(
      0,
      DESCRIPTION_MAX_LENGTH,
    ),
    public_phone: organization.public_phone || "",
    public_email: organization.public_email || "",
    website_url: organization.website_url || organization.website || "",
    facebook_url: organization.facebook_url || "",
    instagram_url: organization.instagram_url || "",
    linkedin_url: organization.linkedin_url || "",
  };
}

export default function ProviderProfilePublic({
  locationId,
  overview,
  workspace,
  onNavigate,
  onSelectLocation,
  onRefresh,
}) {
  const organization =
    overview.organization || workspace?.organizations?.[0] || {};
  const overviewLocation = overview.location || {};
  const rawLocations = workspace?.locations || overview.locations || [];
  const location =
    rawLocations.find((item) => item.id === locationId) ||
    (overviewLocation.id ? overviewLocation : null) ||
    rawLocations[0] ||
    {};
  const locations =
    rawLocations.length > 0 ? rawLocations : location.id ? [location] : [];
  const organizationId =
    organization.id ||
    location.organization_id ||
    workspace?.organizations?.[0]?.id ||
    "";
  const organizationName =
    organization.public_display_name ||
    organization.name ||
    location.organization_name ||
    location.name ||
    "Organizatie";
  const locationCount = locations.length;
  const profileTypeLabel =
    PROVIDER_PROFILE_TYPES[organization.organization_type] ||
    PROVIDER_PROFILE_TYPES[location.provider_profile_type] ||
    PROVIDER_TYPES[location.provider_type] ||
    "Profil";
  const pendingProfile = overview.pending_profile_changes || {};
  const pendingLogoUrl = pendingProfile.pending_logo_url || "";
  const hasPendingLogo = !!pendingProfile.has_pending_logo;
  const canonicalLogo = organization.logo_url || "";
  const profileState = overview.organization_profile_state || {};
  const fallbackValues =
    profileState.fallback || overview.organization_profile_fallback_values || {};
  const fallbackLocationName =
    profileState.fallback_location_name ||
    location.public_display_name ||
    location.name ||
    "locatia principala";
  const baseValues = useMemo(
    () => canonicalValues(organization),
    [organization],
  );

  const [values, setValues] = useState(baseValues);
  const [logoPreview, setLogoPreview] = useState(
    pendingLogoUrl || canonicalLogo,
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState(
    hasPendingLogo ? "Logo trimis separat spre verificare." : "",
  );
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);

  const pendingReview = draft?.status === "pending_review";
  const canSubmitDraft = Boolean(
    draft && ["draft", "needs_more_info"].includes(draft.status),
  );
  const descriptionCount = String(values.public_description || "").length;
  const availableFallbackFields = PROFILE_FIELDS.filter(
    (key) =>
      !String(values[key] || "").trim() &&
      String(fallbackValues[key] || "").trim(),
  );

  const loadDraft = async () => {
    if (!organizationId) return;
    const response = await base44.functions
      .invoke("manageProviderOrganizationProfile", {
        action: "list_mine",
        organization_id: organizationId,
        location_id: locationId,
      })
      .catch(() => ({ data: { submissions: [] } }));
    const active = (response.data?.submissions || []).find((submission) =>
      ["draft", "needs_more_info", "pending_review"].includes(
        submission.status,
      ),
    );
    setDraft(active || null);
    if (active) {
      try {
        setValues({
          ...baseValues,
          ...JSON.parse(active.payload_json || "{}"),
        });
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
    setLogoMessage(
      hasPendingLogo ? "Logo trimis separat spre verificare." : "",
    );
  }, [baseValues, pendingLogoUrl, canonicalLogo, hasPendingLogo]);

  useEffect(() => {
    void loadDraft();
  }, [organizationId, locationId]);

  const setField = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }));

  const startEditing = () => {
    if (pendingReview) return;
    setEditSnapshot({ ...values });
    setMessage("");
    setEditing(true);
  };

  const cancelEditing = () => {
    if (editSnapshot) setValues(editSnapshot);
    setEditSnapshot(null);
    setMessage("");
    setEditing(false);
  };

  const importFallback = () => {
    setValues((current) => {
      const next = { ...current };
      for (const key of PROFILE_FIELDS) {
        if (
          !String(next[key] || "").trim() &&
          String(fallbackValues[key] || "").trim()
        ) {
          next[key] = fallbackValues[key];
        }
      }
      return next;
    });
    setMessage("Datele au fost preluate in formular. Salveaza modificarile.");
  };

  const saveDraft = async () => {
    setSaving(true);
    setMessage("");
    const action =
      draft && draft.status !== "pending_review"
        ? "update_draft"
        : "create_draft";
    const response = await base44.functions
      .invoke("manageProviderOrganizationProfile", {
        action,
        organization_id: organizationId,
        location_id: locationId,
        submission_id: draft?.id,
        payload: {
          ...values,
          public_description: String(values.public_description || "").slice(
            0,
            DESCRIPTION_MAX_LENGTH,
          ),
        },
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
      setMessage(data.message || "Nu exista modificari noi de salvat.");
    } else if (data.duplicate || data.already_pending) {
      setMessage(data.message || "Aceasta modificare este deja in verificare.");
    } else if (data.resumed || data.unchanged) {
      setMessage(data.message || "Draftul existent a fost incarcat.");
    } else {
      setMessage(
        "Modificarile au fost salvate. Profilul afiseaza acum datele din draft.",
      );
    }
    await loadDraft();
    await onRefresh?.();
    setEditSnapshot(null);
    setEditing(false);
  };

  const submitDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    const response = await base44.functions
      .invoke("manageProviderOrganizationProfile", {
        action: "submit",
        organization_id: organizationId,
        location_id: locationId,
        submission_id: draft.id,
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
      setMessage(data.message || "Nu exista modificari noi de trimis.");
    } else if (data.duplicate || data.already_pending) {
      setMessage(data.message || "Aceasta modificare este deja in verificare.");
    } else {
      setMessage("Profilul organizatiei a fost trimis spre verificare.");
    }
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
      setLogoMessage("Logo-ul trebuie sa aiba maximum 4 MB.");
      return;
    }
    setUploadingLogo(true);
    let localPreviewUrl = "";
    try {
      const optimizedFile = await makeSafeLogoFile(file, organizationId);
      localPreviewUrl = URL.createObjectURL(optimizedFile);
      setLogoPreview(localPreviewUrl);
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: optimizedFile,
      });
      const logoUrl = String(uploadResponse?.file_url || "").trim();
      if (!logoUrl) {
        throw new Error("Incarcarea logo-ului nu a returnat un URL valid.");
      }
      const response = await base44.functions
        .invoke("submitProviderLogoForReview", {
          location_id: locationId,
          organization_id: organizationId,
          photo_url: logoUrl,
        })
        .catch((error) => ({
          data: { error: error.response?.data?.error || error.message },
        }));
      if (response.data?.error) throw new Error(response.data.error);
      setLogoPreview(logoUrl);
      setLogoMessage("Logo trimis separat spre verificare.");
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
    <div className="space-y-8 pb-8">
      <header>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#345bc8]">
          <span className="h-2 w-2 bg-[#345bc8]" />
          Identitate publica · organizatie
        </div>
        <h1 className="mt-3 max-w-3xl font-heading text-[2.05rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#171717] sm:text-[2.45rem]">
          Profilul organizatiei tale.
        </h1>
        <p className="mt-2.5 max-w-3xl text-base leading-[1.65] text-[#615e57]">
          Vezi profilul asa cum este prezentat public si editeaza informatiile
          direct in acelasi loc.
        </p>
      </header>

      <OrganizationProfile
        organizationName={organizationName}
        profileTypeLabel={profileTypeLabel}
        verified={location.profile_control_status === "verified"}
        values={values}
        setField={setField}
        logoPreview={logoPreview}
        hasPendingLogo={hasPendingLogo}
        uploadingLogo={uploadingLogo}
        onLogoChange={uploadLogo}
        locationCount={locationCount}
        draft={draft}
        editing={editing}
        onEdit={startEditing}
        onCancel={cancelEditing}
        onSave={saveDraft}
        saving={saving}
        pendingReview={pendingReview}
        descriptionCount={descriptionCount}
        availableFallbackFields={availableFallbackFields}
        fallbackLocationName={fallbackLocationName}
        importFallback={importFallback}
        logoMessage={logoMessage}
        message={message}
      />

      {!editing && (logoMessage || message) && (
        <div className="space-y-2 border-y border-[#171717]/10 py-3 text-sm leading-relaxed text-[#69655d]">
          {logoMessage && (
            <p className="flex items-start gap-2">
              <ImagePlus className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{logoMessage}</span>
            </p>
          )}
          {message && <p>{message}</p>}
        </div>
      )}

      {!editing && canSubmitDraft && (
        <div className="flex flex-col gap-4 rounded-[18px] border border-[#345bc8]/20 bg-[#eef3fb] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#345bc8] text-white">
              <Save className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-[#243b66]">
                Modificarile sunt salvate ca draft
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[#526789]">
                Verifica profilul, apoi trimite modificarile pentru aprobare.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={submitDraft}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#171717] px-5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Trimite spre verificare
          </button>
        </div>
      )}

      {!editing && (
        <LocationsSection
          locations={locations}
          selectedLocationId={location.id}
          onManage={manageLocation}
          onManageAll={() => onNavigate?.("locations")}
        />
      )}
    </div>
  );
}
