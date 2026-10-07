import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CONFIRMATION_LABELS } from "@/lib/directoryOpsCatalog";
import { serviceNeedLevelLabel } from "@/lib/adminLabels";
import { sourceHost } from "@/lib/adminProfileEdit";
import { getServiceLabel } from "@/lib/serviceAutocomplete";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import StatusBadge from "@/components/admin/ui/StatusBadge";

const LEVEL_TONES = { not_confirmed: "neutral", publicly_listed: "info", provider_confirmed: "success", vezunde_verified: "success" };

export default function DirOpsServiceRow({ service, onChanged }) {
  const [level, setLevel] = useState("");
  const [askNote, setAskNote] = useState(false);

  // Aruncă la eroare: fereastra de notă o arată sub câmp și rămâne deschisă.
  const apply = async (note) => {
    const response = await base44.functions.invoke("directoryOps", {
      action: "set_service_confirmation",
      service_id: service.id,
      level,
      note,
    });
    if (response?.data?.error) throw new Error(response.data.error);
    setAskNote(false);
    setLevel("");
    onChanged();
  };

  const host = sourceHost(service.service_source_url);
  const name = service.canonical_label || getServiceLabel(service.service_key);

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-3.5">
      <div className="min-w-0 flex-1 sm:min-w-[180px]">
        <div className="break-words text-sm font-semibold">{name}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge label={serviceNeedLevelLabel(service.service_need_level)} />
          <StatusBadge label={CONFIRMATION_LABELS[service.confirmation_level] || service.confirmation_level} tone={LEVEL_TONES[service.confirmation_level] || "neutral"} />
          <StatusBadge label={service.matching_allowed ? "În recomandări" : "Exclus din recomandări"} tone={service.matching_allowed ? "success" : "neutral"} />
          {service.migration_review_required && <StatusBadge label="De verificat după migrare" tone="warning" />}
          {service.is_active === false && <StatusBadge label="Inactiv" />}
        </div>
        {service.service_source_url && (
          <a
            href={service.service_source_url}
            target="_blank"
            rel="noreferrer"
            title={service.service_source_url}
            className="mt-1.5 inline-block break-all text-xs text-muted-foreground underline underline-offset-2"
          >
            Sursă: {host || service.service_source_url}
          </a>
        )}
      </div>

      <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(190px,1fr)_auto]">
        <label className="sr-only" htmlFor={`service-level-${service.id}`}>
          Schimbă nivelul serviciului {name}
        </label>
        <select
          id={`service-level-${service.id}`}
          className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-base sm:min-h-10 sm:rounded-md sm:text-xs"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        >
          <option value="">Schimbă nivelul…</option>
          {Object.entries(CONFIRMATION_LABELS).map(([key, label]) => (
            <option key={key} value={key} disabled={key === service.confirmation_level}>{label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => level && setAskNote(true)}
          disabled={!level}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold hover:bg-accent disabled:opacity-40 sm:min-h-10 sm:rounded-md sm:text-xs"
        >
          Aplică
        </button>
      </div>

      {askNote && (
        <DirOpsActionNote
          title={`Schimbi nivelul la „${CONFIRMATION_LABELS[level]}”`}
          noteOptional={level === "publicly_listed" || level === "not_confirmed"}
          onConfirm={apply}
          onCancel={() => setAskNote(false)}
        />
      )}
    </div>
  );
}
