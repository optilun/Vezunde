import React, { useState } from "react";
import ProviderAccessMembers from "./ProviderAccessMembers";
import ProviderAccessInvitations from "./ProviderAccessInvitations";

export default function ProviderAccess({ locations }) {
  const [tab, setTab] = useState("members");
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Acces si utilizatori</h1>
      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("members")} className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "members" ? "border-foreground" : "border-transparent text-muted-foreground"}`}>Membri</button>
        <button onClick={() => setTab("invitations")} className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "invitations" ? "border-foreground" : "border-transparent text-muted-foreground"}`}>Invitatii</button>
      </div>
      {tab === "members" ? <ProviderAccessMembers /> : <ProviderAccessInvitations locations={locations} />}
    </div>
  );
}