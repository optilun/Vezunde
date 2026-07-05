import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export default function ProviderMedia({ locationId }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke("getPublicProviderContent", { location_id: locationId })
      .then((res) => setMedia(res.data?.media || []))
      .finally(() => setLoading(false));
  }, [locationId]);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Fotografii si galerie</h1>
      <div className="rounded-xl border border-border bg-accent/40 p-4">
        <p className="text-sm">Incarcarea de imagini va fi disponibila dupa activarea unui sistem securizat de verificare a fisierelor.</p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Se incarca...</p>
      ) : media.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nu exista inca fotografii publicate.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m) => (
            <div key={m.id} className="rounded-lg overflow-hidden border border-border bg-card">
              <img src={m.url} alt={m.alt_text || m.caption || ""} className="w-full h-32 object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}