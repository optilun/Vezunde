import React, { useEffect, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 900000;

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
  const ratio = 4 / 3;
  const sourceRatio = image.width / image.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (sourceRatio > ratio) {
    sw = image.height * ratio;
    sx = (image.width - sw) / 2;
  } else if (sourceRatio < ratio) {
    sh = image.width / ratio;
    sy = (image.height - sh) / 2;
  }

  const width = Math.min(1200, Math.max(640, Math.round(sw)));
  const height = Math.round(width / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  let dataUrl = canvas.toDataURL("image/webp", 0.82);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.6);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) throw new Error("Fotografia rămâne prea mare după optimizare.");
  return dataUrl;
}

export default function ProviderLocationPhotoCompact({ locationId, onRefresh }) {
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [submission, setSubmission] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    const response = await base44.functions.invoke("locationPhotoOps", {
      action: "get",
      location_id: locationId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      return;
    }
    setCurrentPhoto(response.data?.location?.current_photo_url || "");
    setSubmission(response.data?.submission || null);
    setPreview(response.data?.submission?.payload?.photo_data_url || "");
  };

  useEffect(() => {
    setMessage("");
    load();
  }, [locationId]);

  const pending = submission?.status === "pending_review";
  const shownPhoto = preview || currentPhoto;

  const choosePhoto = async (file) => {
    if (!file) return;
    setMessage("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMessage("Format acceptat: JPG, PNG sau WEBP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage("Fotografia trebuie să aibă maximum 4 MB.");
      return;
    }

    setSaving(true);
    try {
      const photoDataUrl = await optimizeLocationPhoto(file);
      setPreview(photoDataUrl);

      const saveResponse = await base44.functions.invoke("locationPhotoOps", {
        action: "save_draft",
        location_id: locationId,
        photo: {
          kind: "location_photo",
          photo_data_url: photoDataUrl,
          remove_photo: false,
        },
      });

      const submissionId = saveResponse.data?.submission?.id;
      if (!submissionId) throw new Error("Draftul fotografiei nu a putut fi creat.");

      await base44.functions.invoke("locationPhotoOps", {
        action: "submit_review",
        location_id: locationId,
        submission_id: submissionId,
      });

      setMessage("Fotografia a fost trimisă spre verificare.");
      await load();
      onRefresh && onRefresh();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Fotografia nu a putut fi trimisă.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="aspect-[4/3] max-h-[360px] bg-secondary/35">
          {shownPhoto ? (
            <img src={shownPhoto} alt="Fotografia locației" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Adaugă fotografia principală a locației</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Folosește o fotografie reală a exteriorului sau interiorului. Va apărea public numai după aprobare.</p>
            </div>
          )}
        </div>
      </div>

      {pending ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Fotografia este în verificare. Fotografia publică actuală rămâne neschimbată până la aprobare.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full ${currentPhoto ? "border border-border bg-background text-foreground" : "bg-foreground text-background"} px-4 py-2.5 text-sm font-semibold hover:opacity-90 ${saving ? "pointer-events-none opacity-50" : ""}`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {currentPhoto ? "Schimbă fotografia" : "Alege fotografia"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={saving}
              onChange={(event) => {
                choosePhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {currentPhoto && <span className="text-xs text-muted-foreground">Fotografie aprobată și publicată</span>}
        </div>
      )}

      {submission?.admin_note && ["needs_more_info", "rejected"].includes(submission.status) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><b>Mesaj Vezunde:</b> {submission.admin_note}</div>
      )}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
