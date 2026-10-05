import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LocationEditorSteps from "./LocationEditorSteps";

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
      reject(new Error("Imaginea nu poate fi citită."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Fotografia nu a putut fi optimizată."));
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

  const width = Math.min(1600, Math.round(sw));
  const height = Math.round(width / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Fotografia nu a putut fi procesată.");
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

  throw new Error("Fotografia rămâne prea mare după optimizare.");
}

export default function ProviderLocationPhotoCompact({ locationId, onRefresh, onDirtyChange, onBusyChange }) {
  const [step, setStep] = useState("choose");
  const [loadError, setLoadError] = useState("");
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [submission, setSubmission] = useState(null);
  const [preview, setPreview] = useState("");
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedPreview, setStagedPreview] = useState("");
  // 2026-09-29 (lint exhaustive-deps): la schimbarea locatiei sau la iesire se elibereaza
  // previzualizarea de ACUM. Inainte, curatarea citea valoarea de la montare (de obicei goala),
  // deci o imagine aleasa si netrimisa ramanea in memoria browserului.
  const stagedPreviewRef = useRef("");
  stagedPreviewRef.current = stagedPreview;
  const [uploadedAsset, setUploadedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const legacyMigrationAttempted = useRef(false);
  const processingRef = useRef(false);

  const clearStaged = () => {
    if (stagedPreview.startsWith("blob:")) URL.revokeObjectURL(stagedPreview);
    setStagedFile(null);
    setStagedPreview("");
    setUploadedAsset(null);
  };

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    setLoadError("");
    const response = await base44.functions.invoke("locationPhotoOps", {
      action: "get",
      location_id: locationId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);

    if (response.data?.error) {
      setLoadError(response.data.error);
      return;
    }

    const nextSubmission = response.data?.submission || null;
    const hasActivePreview = ACTIVE_SUBMISSION_STATUSES.includes(nextSubmission?.status);
    const isLegacyOrganizationLogo = response.data?.legacy_logo_candidate === true;

    setCurrentPhoto(isLegacyOrganizationLogo ? "" : (response.data?.location?.current_photo_url || ""));
    setSubmission(nextSubmission);
    setStep(ACTIVE_SUBMISSION_STATUSES.includes(nextSubmission?.status) ? "review" : "choose");
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
      if (stagedPreviewRef.current.startsWith("blob:")) URL.revokeObjectURL(stagedPreviewRef.current);
    };
    // Se reia doar la schimbarea locatiei; incarcarea si curatarea citesc starea curenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const pending = submission?.status === "pending_review";
  const editableDraft = EDITABLE_SUBMISSION_STATUSES.includes(submission?.status);
  const shownPhoto = stagedPreview || preview || currentPhoto;
  useEffect(() => { onDirtyChange?.(Boolean(stagedFile)); }, [stagedFile, onDirtyChange]);
  useEffect(() => { onBusyChange?.(processing); }, [processing, onBusyChange]);
  useEffect(() => {
    const warn = event => { if (stagedFile || processing) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stagedFile, processing]);

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

    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const optimizedFile = await optimizeLocationPhoto(file, locationId);
      if (stagedPreview.startsWith("blob:")) URL.revokeObjectURL(stagedPreview);
      const localPreviewUrl = URL.createObjectURL(optimizedFile);
      setStagedFile(optimizedFile);
      setStep("preview");
      setStagedPreview(localPreviewUrl);
      setUploadedAsset(null);
      setMessage("Verifică fotografia. Fișierul nu este trimis până nu salvezi draftul.");
    } catch (error) {
      setMessage(error.message || "Fotografia nu a putut fi pregătită.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const saveDraft = async () => {
    if (!stagedFile && !uploadedAsset?.url) return;
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setMessage("");

    try {
      let asset = uploadedAsset;
      if (!asset?.url) {
        setMessage("Fotografia se încarcă...");
        const uploadResponse = await base44.integrations.Core.UploadFile({ file: stagedFile });
        const photoUrl = String(uploadResponse?.file_url || "").trim();
        if (!photoUrl) throw new Error("Încărcarea fotografiei nu a returnat un URL valid.");
        asset = { url: photoUrl };
        setUploadedAsset(asset);
      }
      if (!asset.id) {
        setMessage("Fișierul se înregistrează...");
        const registerResponse = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
          action: "register_upload",
          location_id: locationId,
          storage_reference: asset.url,
        });
        if (registerResponse.data?.error) throw new Error(registerResponse.data.error);
        asset = { id: registerResponse.data?.asset?.id, url: asset.url };
        if (!asset.id) throw new Error("Fișierul încărcat nu a putut fi înregistrat.");
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
      setStep("review");
      setMessage("Draftul fotografiei a fost salvat. Verifică imaginea și trimite-o separat spre aprobare.");
      onRefresh?.();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Draftul fotografiei nu a putut fi salvat.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const submitReview = async () => {
    if (!submission?.id || !editableDraft) return;
    if (processingRef.current) return;
    processingRef.current = true;
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

      setMessage("Fotografia locației a fost trimisă spre verificare.");
      await load();
      onRefresh?.();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Fotografia nu a putut fi trimisă.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const discardDraft = async () => {
    if (stagedFile || stagedPreview) {
      const wasUploaded = Boolean(uploadedAsset?.url);
      clearStaged();
      setStep(editableDraft ? "review" : "choose");
      setMessage(wasUploaded ? "Selecția a fost anulată. Încărcarea anterioară nu a fost trimisă spre verificare." : "Fotografia selectată a fost eliminată. Niciun fișier nu a fost încărcat.");
      return;
    }
    if (!submission?.id || !editableDraft) return;
    if (processingRef.current) return;
    processingRef.current = true;
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
      setStep("choose");
      setMessage("Draftul fotografiei a fost retras. Fișierul a fost adăugat în coada de curățare.");
      onRefresh?.();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Draftul nu a putut fi retras.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă...
      </div>
    );
  }

  return (
    <div className="location-editor photo-editor">
      <LocationEditorSteps label="Configurarea fotografiei" active={pending ? "review" : step} disabled={processing || pending || Boolean(loadError)} onChange={setStep} steps={[
        {id:"choose",label:"Alege fotografia",detail:"JPG, PNG sau WEBP"},
        {id:"preview",label:"Verifică imaginea",detail:"Încadrare 4:3",disabled:!stagedFile && !editableDraft},
        {id:"review",label:"Trimite spre verificare",detail:pending ? "În verificare" : "Draft și aprobare",disabled:!editableDraft || Boolean(stagedFile)},
      ]} />
      {loadError ? <div role="alert" className="location-editor-notice">{loadError} <button type="button" onClick={load} className="location-editor-button ml-2">Reîncearcă încărcarea</button></div> : <>
        <section className="location-editor-panel photo-editor-layout">
          <div>
            <h2>{pending ? "Fotografia este în verificare" : step === "choose" ? "Arată clienților cum arată locația" : step === "preview" ? "Verifică fotografia înainte de încărcare" : "Fotografia este salvată ca draft"}</h2>
            <p className="location-editor-intro">{stagedFile ? "Aceasta este încadrarea care va apărea pe cardul locației." : editableDraft ? "Draftul nu apare public până la aprobare." : currentPhoto ? "Fotografia aprobată rămâne publică până când una nouă este aprobată." : "Alege o imagine a fațadei, interiorului sau spațiului principal."}</p>
            <div className="photo-editor-frame mt-4">
              {shownPhoto ? <img src={shownPhoto} alt={stagedFile ? "Previzualizarea fotografiei selectate" : editableDraft || pending ? "Fotografia din draft" : "Fotografia aprobată a locației"} />
                : <div className="photo-editor-frame__empty"><ImagePlus /><strong className="mt-3 text-sm">Nicio fotografie selectată</strong><p className="location-editor-intro">Adaugă o imagine clară a locației.</p></div>}
            </div>
            <p className="photo-editor-caption">{stagedFile ? "Previzualizare locală · fișierul nu a fost încărcat" : pending ? "Trimisă spre verificare" : editableDraft ? "Draft salvat · încă nepublicat" : currentPhoto ? "Fotografie aprobată" : "Formatul afișat: 4:3"}</p>
          </div>
          <aside className="photo-editor-guidance">
            <h2>{pending ? "Ce urmează?" : step === "review" ? "Gata pentru verificare" : "O fotografie bună"}</h2>
            <ul>
              {pending ? <><li>VIASEE verifică fotografia.</li><li>Fotografia actuală rămâne neschimbată până la aprobare.</li></>
                : step === "review" ? <><li>Verifică imaginea și eventualul mesaj VIASEE.</li><li>Trimite fotografia separat spre verificare.</li><li>Fotografia se publică numai după aprobare.</li></>
                : <><li>Alege lumină bună și o imagine în care se recunoaște locația.</li><li>Folosește o fotografie, în locul logoului organizației.</li><li>Încadrare centrală 4:3, maximum 4 MB. Imaginea este optimizată înainte de încărcare.</li></>}
            </ul>
            {!pending && <label className={`location-editor-button photo-editor-upload ${processing ? "opacity-50" : ""}`}>
              <ImagePlus /> {stagedFile ? "Alege altă fotografie" : currentPhoto || editableDraft ? "Schimbă fotografia" : "Alege fotografia"}
              <input aria-label="Alege fotografia locației" type="file" accept="image/png,image/jpeg,image/webp" disabled={processing} onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }} />
            </label>}
          </aside>
        </section>
        {submission?.admin_note && ["needs_more_info","rejected"].includes(submission.status) && <div className="location-editor-notice"><b>Mesaj VIASEE:</b> {submission.admin_note}</div>}
        {message && <p role="status" className="location-editor-notice">{message}</p>}
        <footer className="location-editor-actions">
          <div className="location-editor-actions__status" role="status">{processing ? "Se procesează fotografia…" : pending ? "În verificare · așteaptă aprobarea" : stagedFile ? "Selecția este doar pe acest dispozitiv" : editableDraft ? "Draft salvat · netrimis" : currentPhoto ? "Fotografia este la zi" : "Alege o fotografie pentru a continua"}</div>
          <div className="location-editor-actions__buttons">
            {(stagedFile || editableDraft) && !pending && <button type="button" disabled={processing} onClick={discardDraft} className="location-editor-button"><Trash2 /> {stagedFile ? "Renunță la selecție" : "Retrage draftul"}</button>}
            {stagedFile && <button type="button" disabled={processing} onClick={saveDraft} className="location-editor-button location-editor-button--primary">{processing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Salvează ca draft</button>}
            {editableDraft && !stagedFile && <button type="button" disabled={processing} onClick={submitReview} className="location-editor-button location-editor-button--primary">{processing ? <Loader2 className="animate-spin" /> : <Send />} Trimite spre verificare</button>}
          </div>
        </footer>
      </>}
    </div>
  );
}

