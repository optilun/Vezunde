import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Save, Send, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 900000;

const STATUS_LABELS = {
  draft: "Draft",
  pending_review: "În verificare",
  needs_more_info: "Necesită completări",
  rejected: "Respinsă",
  approved: "Aprobată",
};

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

async function optimizeLocationPhoto(file) {
  const image = await readImage(file);
  const targetRatio = 16 / 9;
  const sourceRatio = image.width / image.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }

  const maxWidth = 1280;
  const width = Math.min(maxWidth, Math.max(640, Math.round(sw)));
  const height = Math.round(width / targetRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  let dataUrl = canvas.toDataURL("image/webp", 0.82);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.74);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.62);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) throw new Error("Imaginea rămâne prea mare după optimizare. Alege o fotografie mai simplă.");
  return dataUrl;
}

function PhotoPanel({ title, text, photoUrl, emptyText, pending }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
        </div>
        {pending && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">review</span>}
      </div>
      <div className="aspect-video border-t border-border bg-secondary/35">
        {photoUrl ? (
          <img src={photoUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">{emptyText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ProviderLocationPhotos({ workspace, selectedLocationId, onSelectLocation, onRefresh }) {
  const locations = workspace.locations || [];
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) || locations[0] || null,
    [locations, selectedLocationId],
  );
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [submission, setSubmission] = useState(null);
  const [preview, setPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!selectedLocation?.id) return;
    setLoading(true);
    setMsg("");
    const response = await base44.functions.invoke("locationPhotoOps", {
      action: "get",
      location_id: selectedLocation.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      setCurrentPhoto("");
      setSubmission(null);
      setPreview("");
      setRemovePhoto(false);
      return;
    }
    const nextSubmission = response.data?.submission || null;
    const payload = nextSubmission?.payload || null;
    setCurrentPhoto(response.data?.location?.current_photo_url || "");
    setSubmission(nextSubmission);
    setPreview(payload?.photo_data_url || "");
    setRemovePhoto(payload?.remove_photo === true);
  };

  useEffect(() => {
    load();
  }, [selectedLocation?.id]);

  const pendingReview = submission?.status === "pending_review";
  const canSubmit = submission && ["draft", "needs_more_info"].includes(submission.status);

  const chooseFile = async (file) => {
    setMsg("");
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMsg("Format acceptat: PNG, JPG sau WEBP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMsg("Fotografia trebuie să aibă maximum 4 MB înainte de optimizare.");
      return;
    }
    setSaving(true);
    try {
      const dataUrl = await optimizeLocationPhoto(file);
      setPreview(dataUrl);
      setRemovePhoto(false);
      setMsg("Fotografia este pregătită. Salvează draftul, apoi trimite-l spre verificare.");
    } catch (error) {
      setMsg(error.message || "Fotografia nu a putut fi procesată.");
    } finally {
      setSaving(false);
    }
  };

  const markForRemoval = () => {
    if (!currentPhoto && !preview) return;
    setPreview("");
    setRemovePhoto(true);
    setMsg("Eliminarea va deveni publică numai după aprobarea Vezunde.");
  };

  const saveDraft = async () => {
    if (!selectedLocation?.id) return;
    if (!preview && !removePhoto) {
      setMsg("Alege o fotografie sau selectează eliminarea fotografiei actuale.");
      return;
    }
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("locationPhotoOps", {
      action: "save_draft",
      location_id: selectedLocation.id,
      photo: {
        kind: "location_photo",
        photo_data_url: removePhoto ? "" : preview,
        remove_photo: removePhoto,
      },
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Draft salvat. Îl poți trimite acum spre verificare.");
    await load();
    onRefresh && onRefresh();
  };

  const submitReview = async () => {
    if (!selectedLocation?.id || !submission?.id) return;
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("locationPhotoOps", {
      action: "submit_review",
      location_id: selectedLocation.id,
      submission_id: submission.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Fotografia a fost trimisă spre verificare.");
    await load();
    onRefresh && onRefresh();
  };

  if (!selectedLocation) return <p className="text-sm text-muted-foreground">Nu există o locație disponibilă.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Fotografia locației</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            O singură fotografie principală pentru fiecare punct de lucru. Este separată de logo-ul organizației și apare public numai după verificare.
          </p>
        </div>
        {locations.length > 1 && (
          <select
            value={selectedLocation.id}
            onChange={(event) => onSelectLocation && onSelectLocation(event.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold outline-none"
          >
            {locations.map((location) => <option key={location.id} value={location.id}>{location.public_display_name || location.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[24px] border border-border bg-card text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă...</div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <PhotoPanel
              title="Fotografia publicată"
              text="Aceasta rămâne vizibilă până când o fotografie nouă este aprobată."
              photoUrl={currentPhoto}
              emptyText="Nu există încă o fotografie publicată"
            />
            <PhotoPanel
              title={removePhoto ? "Eliminare propusă" : "Fotografie propusă"}
              text={removePhoto ? "Fotografia publicată va fi eliminată după aprobare." : "Previzualizare 16:9 pentru profilul public."}
              photoUrl={removePhoto ? "" : preview}
              emptyText={removePhoto ? "Fotografia va fi eliminată" : "Alege o fotografie pentru previzualizare"}
              pending={pendingReview}
            />
          </div>

          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Gestionează fotografia principală</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Recomandat: exteriorul sau interiorul real al locației, fără colaje, capturi de ecran ori texte promoționale mari.</p>
              </div>
              {submission?.status && (
                <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{STATUS_LABELS[submission.status] || submission.status}</span>
              )}
            </div>

            {submission?.admin_note && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                <b>Mesaj Vezunde:</b> {submission.admin_note}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 ${pendingReview || saving ? "pointer-events-none opacity-50" : ""}`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {preview ? "Schimbă fotografia" : "Alege fotografia"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={pendingReview || saving}
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {(currentPhoto || preview) && (
                <button type="button" disabled={pendingReview || saving} onClick={markForRemoval} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-secondary disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Elimină fotografia
                </button>
              )}
              <button type="button" disabled={pendingReview || saving || (!preview && !removePhoto)} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
                <Save className="h-4 w-4" /> Salvează draft
              </button>
              {canSubmit && (
                <button type="button" disabled={saving} onClick={submitReview} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Send className="h-4 w-4" /> Trimite spre verificare
                </button>
              )}
            </div>

            {pendingReview && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Fotografia este în verificare. Fotografia publică actuală nu se schimbă până la aprobare.
              </div>
            )}
            {msg && <p className="mt-4 text-xs text-muted-foreground">{msg}</p>}
          </section>
        </>
      )}
    </div>
  );
}
