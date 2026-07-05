import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { MapPin } from "lucide-react";

// UI-1 PART 3.C — geographic coverage, honest empty state when no providers exist.
export default function GeoCoverageCard({ geo }) {
  return (
    <AdminCard className="p-5">
      <h3 className="font-heading font-bold text-sm">Acoperire geografica</h3>
      {geo.locationsCount === 0 ? (
        <EmptyState icon={MapPin} title="Geografia nationala este pregatita, dar nu exista inca profiluri reale." subtitle="Cele 42 de judete si localitatile SIRUTA sunt deja incarcate in platforma." />
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Judete cu locatii active</span><span className="font-semibold">{geo.countiesWithLocations}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Judete fara locatii</span><span className="font-semibold">{geo.countiesWithoutLocations}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Localitati cu profiluri publicate</span><span className="font-semibold">{geo.localitiesPublished}</span></div>
        </div>
      )}
    </AdminCard>
  );
}