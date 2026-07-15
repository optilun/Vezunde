import React, { useEffect, useState } from "react";
import { Camera, Loader2, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const PHOTO_MAX_DATA_URL_LENGTH = 800000;
const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/40 disabled:opacity-60";

function initials(value = "") {
  return String(value || "U")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

function initialValues(user) {
  return {
    full_name: user?.full_name || user?.name || "",
    personal_bio: user?.personal_bio || "",
    profile_photo_url: user?.profile_photo_url || "",
  };
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Imaginea nu poate fi citita."));
    };
    image.src = objectUrl;
  });
}

async function makeSafePhotoDataUrl(file) {
  const image = await readImage(file);
  const canvas = document.createElement("canvas");
  const maxSide = 512;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let dataUrl = canvas.toDataURL("image/webp", 0.82);
  if (dataUrl.length > PHOTO_MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > PHOTO_MAX_DATA_URL_LENGTH) throw new Error("Fotografia este prea mare dupa optimizare.");
  return dataUrl;
}

export default function PersonalProfileSettings({ user, onRefresh }) {
  const [values, setValues] = useState(() => initialValues(user));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setValues(initialValues(user));
  }, [user?.id, user?.full_name, user?.personal_bio, user?.profile_photo_url]);

  const setField = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const choosePhoto = async (file) => {
    setError("");
    setMessage("");
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setError("Format acceptat: PNG, JPG sau WEBP.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("Fotografia trebuie sa aiba maximum 4 MB inainte de optimizare.");
      return;
    }
    setUploading(true);
    try {
      setField("profile_photo_url", await makeSafePhotoDataUrl(file));
      setMessage("Fotografia este pregatita. Apasa Salveaza profilul pentru a o pastra.");
    } catch (photoError) {
      setError(photoError.message || "Fotografia nu a putut fi pregatita.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const fullName = values.full_name.trim();
    const personalBio = values.personal_bio.trim();
    if (fullName.length < 3 || fullName.length > 120) {
      setError("Numele trebuie sa aiba intre 3 si 120 de caractere.");
      return;
    }
    if (personalBio.length > 500) {
      setError("Descrierea poate avea maximum 500 de caractere.");
      return;
    }

    setSaving(true);
    try {
      const updatedUser = await base44.auth.updateMe({
        full_name: fullName,
        personal_bio: personalBio,
        profile_photo_url: values.profile_photo_url,
      });
      setValues(initialValues(updatedUser));
      setMessage("Profilul personal a fost salvat.");
      await onRefresh?.();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError?.message || "Profilul personal nu a putut fi salvat.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-border bg-foreground font-heading text-lg font-black text-background">
          {values.profile_photo_url
            ? <img src={values.profile_photo_url} alt="Fotografie profil personal" className="h-full w-full object-cover" />
            : initials(values.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Fotografie de profil</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Este folosita in contul tau VIASEE. Nu devine automat fotografie profesionala publica.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {values.profile_photo_url ? "Schimba fotografia" : "Adauga fotografia"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading || saving}
                onChange={(event) => {
                  choosePhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {values.profile_photo_url && (
              <button type="button" onClick={() => setField("profile_photo_url", "")} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold text-destructive hover:bg-secondary disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> Elimina
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="personal-full-name" className="text-xs font-semibold text-muted-foreground">Nume</label>
          <input
            id="personal-full-name"
            value={values.full_name}
            onChange={(event) => setField("full_name", event.target.value)}
            maxLength={120}
            autoComplete="name"
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Email cont</label>
          <div className={`mt-1.5 flex min-h-10 items-center text-muted-foreground ${inputClass}`}>{user?.email || "Email indisponibil"}</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="personal-bio" className="text-xs font-semibold text-muted-foreground">Descriere scurta</label>
          <span className="text-[11px] text-muted-foreground">{values.personal_bio.length}/500</span>
        </div>
        <textarea
          id="personal-bio"
          value={values.personal_bio}
          onChange={(event) => setField("personal_bio", event.target.value)}
          maxLength={500}
          rows={4}
          className={`mt-1.5 resize-y ${inputClass}`}
          placeholder="Spune pe scurt cateva lucruri despre tine. Acest text ramane in zona personala."
        />
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
      {message && <div role="status" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">{message}</div>}

      <div className="flex justify-end">
        <button type="submit" disabled={saving || uploading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50 sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salveaza profilul
        </button>
      </div>
    </form>
  );
}
