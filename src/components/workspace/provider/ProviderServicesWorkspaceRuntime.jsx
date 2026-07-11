import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderServicesWorkspaceOperational from "./ProviderServicesWorkspaceOperational";
import ProviderServicesWorkspaceStructured from "./ProviderServicesWorkspaceStructured";

function backendFunctionMissing(error) {
  const status = error?.response?.status;
  const payload = error?.response?.data || {};
  const message = [payload.message, payload.detail, payload.error, error?.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return status === 404 && (
    message.includes("not found")
    || message.includes("not deployed")
    || message.includes("backend function")
  );
}

export default function ProviderServicesWorkspaceRuntime(props) {
  const locationId = props.locationId || props.location?.id;
  const [mode, setMode] = useState("checking");

  useEffect(() => {
    let active = true;

    if (!locationId) {
      setMode("operational");
      return () => { active = false; };
    }

    setMode("checking");

    Promise.allSettled([
      base44.functions.invoke("getProviderServiceConfiguration", { location_id: locationId }),
      base44.functions.invoke("providerServiceConfigurationOps", {
        action: "list_mine",
        location_id: locationId,
      }),
    ]).then((results) => {
      if (!active) return;
      const missingBackend = results.some(
        (result) => result.status === "rejected" && backendFunctionMissing(result.reason),
      );
      setMode(missingBackend ? "compatibility" : "operational");
    });

    return () => { active = false; };
  }, [locationId]);

  if (mode === "checking") {
    return (
      <div className="rounded-[24px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
        Se verifică serviciile locației...
      </div>
    );
  }

  if (mode === "compatibility") {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Modul de compatibilitate este activ. Poți verifica și salva catalogul prin fluxul existent;
            asocierea persistentă a spațiilor, capabilităților și dotărilor va fi activată după publicarea backendului nou.
          </p>
        </div>
        <ProviderServicesWorkspaceStructured {...props} />
      </div>
    );
  }

  return <ProviderServicesWorkspaceOperational {...props} />;
}
