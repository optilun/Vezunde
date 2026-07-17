import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CONFIRMATION_LABELS } from "@/lib/directoryOpsCatalog";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";

export default function DirOpsServiceRow({ service, location, onChanged }) {
  const [level, setLevel] = useState("");
  const [askNote, setAskNote] = useState(false);

  const apply = async (note) => {
    await base44.functions.invoke("directoryOps", {
      action: "set_service_confirmation",
      service_id: service.id,
      level,
      note,
    });
    setAskNote(false);
    setLevel("");
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-3.5">
      <div className="min-w-0 flex-1 sm:min-w-[180px]">
        <div className="break-words text-sm font-semibold">{service.service_key}</div>
        <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
          {service.service_need_level || "general"}
          {" · "}{CONFIRMATION_LABELS[service.confirmation_level] || service.confirmation_level}
          {" · "}matching {service.matching_allowed ? "permis" : "blocat"}
          {service.migration_review_required && (
            <span className="ml-2 font-semibold text-destructive">review migrare</span>
          )}
        </div>
        {service.service_source_url && (
          <a
            href={service.service_source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block break-all text-xs text-muted-foreground underline"
          >
            {service.service_source_url}
          </a>
        )}
      </div>

      <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(190px,1fr)_auto]">
        <label className="sr-only" htmlFor={`service-level-${service.id}`}>
          Schimba nivelul serviciului
        </label>
        <select
          id={`service-level-${service.id}`}
          className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm sm:min-h-10 sm:rounded-md sm:text-xs"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        >
          <option value="">Schimba nivel...</option>
          <option value="not_confirmed">Neconfirmat</option>
          <option value="publicly_listed">Listat public</option>
          <option value="provider_confirmed">Confirmat de furnizor</option>
          <option value="vezunde_verified">Verificat VIASEE</option>
        </select>
        <button
          type="button"
          onClick={() => level && setAskNote(true)}
          disabled={!level}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold hover:bg-accent disabled:opacity-40 sm:min-h-10 sm:rounded-md sm:text-xs"
        >
          Aplica
        </button>
      </div>

      {askNote && (
        <DirOpsActionNote
          title={`Schimbare nivel serviciu la "${CONFIRMATION_LABELS[level]}" — nota de audit`}
          noteOptional={level === "publicly_listed" || level === "not_confirmed"}
          onConfirm={apply}
          onCancel={() => setAskNote(false)}
        />
      )}
    </div>
  );
}
