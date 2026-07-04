import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import PhotoUpload from "@/components/request/PhotoUpload";
import { DETAILS_CONFIG } from "@/lib/intake";

export default function StepDetails({ data, update, onNext }) {
  const config = DETAILS_CONFIG[data.category];
  if (!config) return null;

  if (config.textarea) {
    return (
      <div>
        <textarea
          value={data.problemText}
          onChange={(e) => update({ problemText: e.target.value, services: config.services })}
          placeholder="Descrie in cuvintele tale ce te deranjeaza..."
          rows={5}
          className="w-full bg-card border border-border rounded-2xl p-4 text-base outline-none focus:border-foreground/40 transition-colors resize-none"
        />
        <p className="mt-3 text-sm text-muted-foreground">{config.note}</p>
        <ContinueButton onClick={() => onNext()} disabled={!data.problemText.trim()} />
      </div>
    );
  }

  const selectDone = !!data.detailLabel;

  return (
    <div>
      <div className="space-y-3">
        {config.options.map((o) => (
          <ChoiceCard
            key={o.label}
            label={o.label}
            selected={data.detailLabel === o.label}
            onClick={() => {
              update({ detailLabel: o.label, services: o.services, for_whom: o.for_whom || data.for_whom });
              if (!config.photos) onNext();
            }}
          />
        ))}
      </div>
      {config.photos && (
        <div className="mt-7">
          <div className="text-sm font-semibold">Adauga fotografii (optional, max 3)</div>
          <PhotoUpload photos={data.photos} onChange={(photos) => update({ photos })} />
          <p className="mt-3 text-sm text-muted-foreground">{config.note}</p>
          <ContinueButton onClick={() => onNext()} disabled={!selectDone} />
        </div>
      )}
    </div>
  );
}