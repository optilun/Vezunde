import React, { useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminWorkspaceSubmissionsReview from "@/components/admin/directory/AdminWorkspaceSubmissionsReview";
import AdminNewLocationReview from "@/components/admin/directory/AdminNewLocationReview";
import AdminProfessionalProfileReview from "@/components/admin/directory/AdminProfessionalProfileReview";
import AdminLocationLifecycleReview from "@/components/admin/directory/AdminLocationLifecycleReview";

const TABS = [
  {
    key: "workspace",
    label: "Profil si continut",
    description: "Profil organizational, date locatie, servicii, fotografii, program, echipa si articole.",
  },
  {
    key: "lifecycle",
    label: "Stare locatii",
    description: "Ascunderea temporara, republicarea si inchiderea locatiilor.",
  },
  {
    key: "locations",
    label: "Locatii noi",
    description: "Puncte de lucru noi trimise pentru organizatii existente.",
  },
  {
    key: "professionals",
    label: "Specialisti",
    description: "Profiluri profesionale trimise spre verificare publica.",
  },
];

export default function AdminReviewQueue() {
  const [tab, setTab] = useState("workspace");
  const activeTab = TABS.find((item) => item.key === tab) || TABS[0];

  return (
    <div className="space-y-5">
      <AdminCard className="p-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                tab === item.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="px-2 pb-2 pt-3 text-xs leading-relaxed text-muted-foreground">
          {activeTab.description}
        </p>
      </AdminCard>

      {tab === "workspace" && <AdminWorkspaceSubmissionsReview />}
      {tab === "lifecycle" && <AdminLocationLifecycleReview />}
      {tab === "locations" && <AdminNewLocationReview />}
      {tab === "professionals" && <AdminProfessionalProfileReview />}
    </div>
  );
}
