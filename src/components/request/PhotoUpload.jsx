import React, { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PhotoUpload({ photos, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    onChange([...photos, ...urls]);
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {photos.map((url, i) => (
        <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
          <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(photos.filter((p) => p !== url))}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-foreground/70 text-background flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      {photos.length < 3 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 rounded-xl border border-dashed border-border bg-card flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
}