import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACTIVE_SUBMISSION_STATUSES = ["draft", "pending_review", "needs_more_info"];
const EDITABLE_SUBMISSION_STATUSES = ["draft", "needs_more_info"];
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_OPTIMIZED_BYTES = 2 * 1024 * 1024;

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
        reject(new Error("Fotografia nu a putut fi optimizata."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

async function optimizeLocationPhoto(file, locationId) {
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
  if (!context) throw new Error("Fotografia nu a putut fi procesata.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  const attempts = [
    { type: "image/webp", quality: 0.82, extension: "webp" },
    { type: "image/jpeg", quality: 0.76, extension: "jpg" },
    { type: "image/jpeg", quality: 0.62, extension: "jpg" },
  ];

  for (const attempt of attempts) {
    const blob = await canvasToBlob(canvas, attempt.type, attempt.quality);
    if (blob.size <= MAX_OPTIMIZED_BYTES) {
      return new File(
        [blob],
        `location-${locationId}-${Date.now()}.${attempt.extension}`,
        { type: attempt.type, lastModified: Date.now() },
      );
    }
  }

  throw new Error("Fotografia ramane prea mare dupa optimizare.");
}

export default function ProviderLocationPhotoCompact({ locationId, onRefresh }) {
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [submission, setSubmission] = useState(null);
  const [preview, setPreview] = useState("");
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedPreview, setStagedPreview] = useState("");
  const [uploadedAsset, setUploadedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const legacyMigrationAttempted = useRef(false);

  const clearStaged = () => {
    if (stagedPreview.startsWith("blob:")) URL.revokeObjectURL(stagedPreview);
    setStagedFile(null);
    setStagedPreview("");
    setUploadedAsset(null);
  };

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

    const nextSubmission = response.data?.submission || null;
    const hasActivePreview = ACTIVE_SUBMISSION_STATUSES.includes(nextSubmission?.status);
    const isLegacyOrganizationLogo = response.data?.legacy_logo_candidate === true;

    setCurrentPhoto(isLegacyOrganizationLogo ? "" : (response.data?.location?.current_photo_url || ""));
    setSubmission(nextSubmission);
    setPreview(hasActivePreview
      ? (nextSubmission?.payload?.photo_url || nextSubmission?.payload?.photo_data_url || "")
      : "");

    if (isLegacyOrganizationLogo && !legacyMigrationAttempted.current) {
      legacyMigrationAttempted.current = true;
      base44.functions.invoke("preserveLegacyLocationLogo", {
        location_id: locationId,
      }).catch(() => null);
    }
  };

  useEffect(() => {
    setMessage("");
    legacyMigrationAttempted.current = false;
    clearStaged();
    load();
    return () => {
      if (stagedPreview.startsWith("blob:")) URL.revokeObjectURL(stagedPreview);
    };
  }, [locationId]);

  const pending = submission?.status === "pending_review";
  const editableDraft = EDITABLE_SUBMISSION_STATUSES.includes(submission?.status);
  const shownPhoto = stagedPreview || preview || currentPhoto;

  const choosePhoto = async (file) => {
    if (!file) return;
    setMessage("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMessage("Format acceptat: JPG, PNG sau WEBP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage("Fotografia trebuie sa aiba maximum 4 MB.");
      return;
    }

    setProcessing(true);
    try {
      const optimizedFile = await optimizeLocationPhoto(file, locationId);
      if (stagedPreview.startsWith("blob:")) URL.revokeObjectURL(stagedPreview);
      const localPreviewUrl = URL.createObjectURL(optimizedFile);
      setStagedFile(optimizedFile);
      setStagedPreview(localPreviewUrl);
      setUploadedAsset(null);
      setMessage("Verifica fotografia. Fisierul nu este trimis pana nu salvezi draftul.");
    } catch (error) {
      setMessage(error.message || "Fotografia nu a putut fi pregatita.");
    } finally {
      setProcessing(false);
    }
  };

  const saveDraft = async () => {
    if (!stagedFile && !uploadedAsset?.url) return;
    setProcessing(true);
    setMessage("");

    try {
      let asset = uploadedAsset;
      if (!asset?.url || !asset?.id) {
        setMessage("Fotografia se incarca si se inregistreaza...");
        const uploadResponse = await base44.integrations.Core.UploadFile({ file: stagedFile });
        const photoUrl = String(uploadResponse?.file_url || "").trim();
        if (!photoUrl) throw new Error("Incarcarea fotografiei nu a returnat un URL valid.");

        const registerResponse = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
          action: "register_upload",
          location_id: locationId,
          storage_reference: photoUrl,
        });
        if (registerResponse.data?.error) throw new Error(registerResponse.data.error);
        asset = { id: registerResponse.data?.asset?.id, url: photoUrl };
        if (!asset.id) throw new Error("Fisierul incarcat nu a putut fi inregistrat.");
        setUploadedAsset(asset);
      }

      const saveResponse = await base44.functions.invoke("locationPhotoOps", {
        action: "save_draft",
        location_id: locationId,
        photo: {
          kind: "location_photo",
          photo_url: asset.url,
          remove_photo: false,
        },
      });
      if (saveResponse.data?.error) throw new Error(saveResponse.data.error);
      const nextSubmission = saveResponse.data?.submission;
      if (!nextSubmission?.id) throw new Error("Draftul fotografiei nu a putut fi creat.");

      const attachResponse = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
        action: "attach_upload",
        location_id: locationId,
        asset_id: asset.id,
        submission_id: nextSubmission.id,
      });
      if (attachResponse.data?.error) throw new Error(attachResponse.data.error);

      setSubmission(nextSubmission);
      setPreview(asset.url);
      clearStaged();
      setMessage("Draftul fotografiei a fost salvat. Verifica imaginea si trimite-o separat spre aprobare.");
      onRefresh?.();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Draftul fotografiei nu a putut fi salvat.");
    } finally {
      setProcessing(false);
    }
  };

  const submitReview = async () => {
    if (!submission?.id || !editableDraft) return;
    setProcessing(true);
    setMessage("");
    try {
      const submitResponse = await base44.functions.invoke("locationPhotoOps", {
        action: "submit_review",
        location_id: locationId,
        submission_id: submission.id,
      });
      if (submitResponse.data?.error) throw new Error(submitResponse.data.error);

      await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
        action: "sync_submission_status",
        location_id: locationId,
        submission_id: submission.id,
      }).catch(() => null);

      setMessage("Fotografia locatiei a fost trimisa spre verificare.");
      await load();
      onRefresh?.();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Fotografia nu a putut fi trimisa.");
    } finally {
      setProcessing(false);
    }
  };

  const discardDraft = async () => {
    if (stagedFile || stagedPreview) {
      clearStaged();
      setMessage("Fotografia selectata a fost eliminata. Niciun fisier nu a fost incarcat.");
      return;
    }
    if (!submission?.id || !editableDraft) return;
    setProcessing(true);
    setMessage("");
    try {
      const response = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
        action: "discard_draft",
        location_id: locationId,
        submission_id: submission.id,
      });
      if (response.data?.error) throw new Error(response.data.error);
      setSubmission(null);
      setPreview("");
      setMessage("Draftul fotografiei a fost retras. Fisierul a fost adaugat in coada de curatare.");
      onRefresh?.();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Draftul nu a putut fi retras.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2">
          <div className="text-sm font-bold">Fotografie principala a locatiei</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Alege fotografia, verifica previzualizarea, salveaza draftul si trimite-l separat spre aprobare.
          </p>
        </div>

        <div className="overflow-hidden rounded-[22px] border border-border bg-card">
          <div className="aspect-[4/3] max-h-[420px] bg-secondary/35">
            {shownPhoto ? (
              <img src={shownPhoto} alt="Fotografia locatiei" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <ImagePlus className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">Adauga fotografia locatiei</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Poate fi o imagine a fatadei, interiorului sau spatiului principal.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {pending ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Fotografia locatiei este in verificare. Fotografia publica actuala ramane neschimbata pana la aprobare.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full ${currentPhoto || editableDraft ? "border border-border bg-background text-foreground" : "bg-foreground text-background"} px-4 py-2.5 text-sm font-semibold hover:opacity-90 ${processing ? "pointer-events-none opacity-50" : ""}`}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {stagedFile ? "Alege alta fotografie" : editableDraft ? "Schimba fotografia din draft" : currentPhoto ? "Schimba fotografia locatiei" : "Alege fotografia locatiei"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={processing}
                onChange={(event) => {
                  choosePhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {currentPhoto && !preview && !stagedPreview && <span className="text-xs text-muted-foreground">Fotografie aprobata si publicata</span>}
            {editableDraft && !stagedFile && <span className="text-xs font-semibold text-amber-800">Draft nestrimis</span>}
            {stagedFile && <span className="text-xs font-semibold text-blue-800">Previzualizare locala, neincarcata</span>}
          </div>

          {(stagedFile || editableDraft) && (
            <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
              {stagedFile && (
                <button type="button" disabled={processing} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-40">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salveaza ca draft
                </button>
              )}
              {editableDraft && !stagedFile && (
                <button type="button" disabled={processing} onClick={submitReview} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Trimite spre verificare
                </button>
              )}
              <button type="button" disabled={processing} onClick={discardDraft} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-red-50 disabled:opacity-40">
                <Trash2 className="h-4 w-4" /> {stagedFile ? "Renunta la selectie" : "Retrage draftul"}
              </button>
            </div>
          )}
        </div>
      )}

      {submission?.admin_note && ["needs_more_info", "rejected"].includes(submission.status) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <b>Mesaj VIASEE:</b> {submission.admin_note}
        </div>
      )}

      {message && <p className="text-xs leading-relaxed text-muted-foreground">{message}</p>}
    </div>
  );
}
