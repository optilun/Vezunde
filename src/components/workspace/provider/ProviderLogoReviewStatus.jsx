import React, { useEffect, useState } from "react";
import { CheckCircle2, ImagePlus, Info, Loader2, TriangleAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_COPY = {
  pending_review: {
    icon: Loader2,
    title: "Logo în verificare",
    description: "Logo-ul este analizat separat. Datele text ale profilului pot avea un alt status.",
    className: "border-amber-200 bg-amber-50 text-amber-950",
    iconClassName: "animate-spin text-amber-700",
  },
  rejected: {
    icon: TriangleAlert,
    title: "Logo neaprobat",
    description: "Logo-ul publicat anterior rămâne neschimbat. Poți încărca o altă variantă.",
    className: "border-red-200 bg-red-50 text-red-950",
    iconClassName: "text-red-700",
  },
  approved: {
    icon: CheckCircle2,
    title: "Logo aprobat",
    description: "Logo-ul organizației a fost aprobat și publicat separat de datele profilului.",
    className: "border-green-200 bg-green-50 text-green-950",
    iconClassName: "text-green-700",
  },
};

function recentApproval(reviewedAt) {
  if (!reviewedAt) return false;
  const timestamp = new Date(reviewedAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= 14 * 24 * 60 * 60 * 1000;
}

export default function ProviderLogoReviewStatus({ organizationId, locationId }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!organizationId && !locationId) return;
    const response = await base44.functions.invoke("getProviderLogoReviewStatus", {
      organization_id: organizationId,
      location_id: locationId,
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message },
    }));
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setError("");
    setState(response.data || null);
  };

  useEffect(() => {
    let mounted = true;
    if (!organizationId && !locationId) return undefined;
    base44.functions.invoke("getProviderLogoReviewStatus", {
      organization_id: organizationId,
      location_id: locationId,
    }).then((response) => {
      if (!mounted) return;
      if (response.data?.error) setError(response.data.error);
      else {
        setError("");
        setState(response.data || null);
      }
    }).catch((requestError) => {
      if (mounted) setError(requestError.response?.data?.error || requestError.message || "");
    });
    const onFocus = () => { if (mounted) void load(); };
    window.addEventListener("focus", onFocus);
    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [organizationId, locationId]);

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" /> Starea separată a logo-ului nu a putut fi încărcată.
      </div>
    );
  }

  if (!state || state.status === "none") return null;
  if (state.status === "approved" && !recentApproval(state.reviewed_at)) return null;
  const config = STATUS_COPY[state.status];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <section className={`flex flex-col gap-4 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${config.className}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
          <Icon className={`h-4 w-4 ${config.iconClassName}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold">{config.title}</h2>
            <span className="rounded-full border border-current/15 bg-white/55 px-2.5 py-1 text-[10px] font-bold">Verificare media separată</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed opacity-85">{config.description}</p>
          {state.note && state.status === "rejected" && (
            <p className="mt-2 text-xs leading-relaxed"><b>Mesaj administrator:</b> {state.note}</p>
          )}
        </div>
      </div>
      {state.status === "rejected" && (
        <span className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold">
          <ImagePlus className="h-4 w-4" /> Încarcă o variantă nouă din zona logo-ului
        </span>
      )}
    </section>
  );
}
