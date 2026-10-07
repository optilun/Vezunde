import React from "react";
import OutreachCampaignList from "./OutreachCampaignList";
import OutreachCampaignDetail from "./OutreachCampaignDetail";
import OutreachContactsList from "./OutreachContactsList";
import OutreachTemplateEditor from "./OutreachTemplateEditor";
import AdminTabs from "@/components/admin/ui/AdminTabs";
import { useAdminSelectedId, useAdminSubTab } from "@/components/admin/useAdminRoute";

const SUBTABS = [
  { key: "campanii", label: "Campanii" },
  { key: "contacte", label: "Contacte" },
  { key: "sabloane", label: "Șabloane marketing" },
];

// 2026-10-07: sub-tab-ul și campania deschisă sunt în adresă (?t=campanii&id=…): o campanie se
// poate deschide direct dintr-un link, iar Înapoi revine la listă.
export default function OutreachWorkspace() {
  const [subTab, setSubTab] = useAdminSubTab(SUBTABS.map((item) => item.key), "campanii");
  const [selectedCampaignId, setSelectedCampaignId] = useAdminSelectedId();

  return (
    <div>
      <div className="border-b border-border pb-4">
        <AdminTabs tabs={SUBTABS} value={subTab} onChange={setSubTab} label="Campanii și marketing" />
      </div>

      <div className="mt-5 space-y-5">
        {subTab === "campanii" && (
          selectedCampaignId ? (
            <OutreachCampaignDetail campaignId={selectedCampaignId} onBack={() => setSelectedCampaignId("")} />
          ) : (
            <OutreachCampaignList onSelect={setSelectedCampaignId} />
          )
        )}
        {subTab === "contacte" && <OutreachContactsList />}
        {subTab === "sabloane" && <OutreachTemplateEditor />}
      </div>
    </div>
  );
}
