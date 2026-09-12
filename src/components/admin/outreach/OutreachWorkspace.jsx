import React, { useState } from "react";
import OutreachCampaignList from "./OutreachCampaignList";
import OutreachCampaignDetail from "./OutreachCampaignDetail";
import OutreachContactsList from "./OutreachContactsList";
import OutreachTemplateEditor from "./OutreachTemplateEditor";

const SUBTABS = [
  { key: "campanii", label: "Campanii" },
  { key: "contacte", label: "Contacte" },
  { key: "sabloane", label: "Sabloane" },
];

export default function OutreachWorkspace() {
  const [subTab, setSubTab] = useState("campanii");
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {SUBTABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => { setSubTab(item.key); setSelectedCampaignId(null); }}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${subTab === item.key ? "bg-foreground text-background" : "border border-border hover:bg-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {subTab === "campanii" && (
          selectedCampaignId ? (
            <OutreachCampaignDetail campaignId={selectedCampaignId} onBack={() => setSelectedCampaignId(null)} />
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
