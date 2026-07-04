import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SERVICE_CATALOG_3C, CONFIRMATION_LABELS } from "@/lib/directoryOpsCatalog";
import DirOpsServiceAdd from "@/components/admin/directory/DirOpsServiceAdd";
import DirOpsServiceRow from "@/components/admin/directory/DirOpsServiceRow";

export default function DirOpsServices() {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [services, setServices] = useState(null);

  useEffect(() => { base44.entities.ProviderLocation.list("name", 300).then(setLocations); }, []);

  const loadServices = (id) =>
    base44.entities.LocationService.filter({ location_id: id }, null, 100).then(setServices);

  useEffect(() => {
    if (locationId) loadServices(locationId);
    else setServices(null);
  }, [locationId]);

  const location = locations.find((l) => l.id === locationId);

  return (
    <div className="max-w-3xl">
      <label className="block text-xs font-semibold text-muted-foreground mb-1">Alege locatia</label>
      <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-card" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">Alege...</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.city} ({l.profile_control_status || "directory"})</option>)}
      </select>

      {location && (
        <>
          <h3 className="font-heading font-bold text-sm mt-6">Servicii existente</h3>
          <div className="space-y-2 mt-2">
            {services === null && <p className="text-muted-foreground text-sm">Se incarca...</p>}
            {services && services.length === 0 && <p className="text-muted-foreground text-sm">Niciun serviciu inregistrat.</p>}
            {services && services.map((s) => (
              <DirOpsServiceRow key={s.id} service={s} location={location} onChanged={() => loadServices(locationId)} />
            ))}
          </div>

          <h3 className="font-heading font-bold text-sm mt-8">Adauga serviciu (doar din catalogul aprobat)</h3>
          <DirOpsServiceAdd location={location} onAdded={() => loadServices(locationId)} />
        </>
      )}
    </div>
  );
}