import React, { useEffect, useRef } from "react";
import AdminWorkspaceSubmissionsReview from "@/components/admin/directory/AdminWorkspaceSubmissionsReview";
import AdminNewLocationReview from "@/components/admin/directory/AdminNewLocationReview";
import AdminProfessionalProfileReview from "@/components/admin/directory/AdminProfessionalProfileReview";
import AdminLocationLifecycleReview from "@/components/admin/directory/AdminLocationLifecycleReview";
import AdminPhotoCleanupQueue from "@/components/admin/directory/AdminPhotoCleanupQueue";
import AdminTabs from "@/components/admin/ui/AdminTabs";
import AdminPatientRequestRecoveryQueue from "./AdminPatientRequestRecoveryQueue";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { useAdminSubTab } from "@/components/admin/useAdminRoute";

// 2026-10-07: fiecare tab arată câte elemente așteaptă (aceleași numere ca în Panou și în meniu),
// iar dacă intri în Coadă fără un tab ales și primul e gol, te duce la primul tab unde chiar
// așteaptă ceva. Descrierile sunt o singură linie scurtă.
const TABS = [
  { key: "workspace", label: "Profil și conținut", description: "Profil, date locație, servicii, fotografii, program, echipă, articole." },
  { key: "locations", label: "Locații noi", description: "Locații noi, profiluri existente și transferuri între organizații." },
  { key: "lifecycle", label: "Stare locații", description: "Ascundere temporară, republicare și închidere de locații." },
  { key: "professionals", label: "Specialiști", description: "Profiluri profesionale trimise spre verificare publică." },
  { key: "patient_requests", label: "Cereri fără rezultate", description: "Cereri salvate de pacienți după o căutare fără rezultate." },
  { key: "media_cleanup", label: "Curățare media", description: "Fotografii retrase sau înlocuite, de șters din stocare." },
];
const TAB_KEYS = TABS.map((tab) => tab.key);

export default function AdminReviewQueue() {
  const { counts } = useAdminCounts();
  const [tab, setTab, { explicit }] = useAdminSubTab(TAB_KEYS, TABS[0].key);
  const autoPicked = useRef(false);

  useEffect(() => {
    if (autoPicked.current || explicit || !counts) return;
    autoPicked.current = true;
    if (counts.review?.[TABS[0].key] === 0) {
      const firstWithWork = TABS.find((item) => counts.review?.[item.key] > 0);
      if (firstWithWork) setTab(firstWithWork.key, { replace: true });
    }
  }, [counts, explicit, setTab]);

  const tabs = TABS.map((item) => ({ ...item, count: counts?.review?.[item.key] ?? null }));
  const activeTab = TABS.find((item) => item.key === tab) || TABS[0];

  return (
    <div className="space-y-5">
      <div>
        <AdminTabs tabs={tabs} value={tab} onChange={setTab} label="Coada de verificare" />
        <p className="mt-3 text-xs text-muted-foreground">{activeTab.description}</p>
      </div>

      {tab === "workspace" && <AdminWorkspaceSubmissionsReview />}
      {tab === "patient_requests" && <AdminPatientRequestRecoveryQueue />}
      {tab === "lifecycle" && <AdminLocationLifecycleReview />}
      {tab === "locations" && <AdminNewLocationReview />}
      {tab === "professionals" && <AdminProfessionalProfileReview />}
      {tab === "media_cleanup" && <AdminPhotoCleanupQueue />}
    </div>
  );
}
