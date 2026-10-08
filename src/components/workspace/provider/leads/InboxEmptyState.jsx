import React from "react";
import { Search, Inbox } from "lucide-react";
import { providerRequestLocationBlocker } from "@/lib/providerLeadAccessPresentation";

export default function InboxEmptyState({ filter, search = "", status = "", location = {}, entitlement = null, onOpenLocation = null, onOpenRequestSettings = null }) {
  const narrowed = Boolean(search.trim() || status);
  const blocker = filter === "active" && !narrowed ? providerRequestLocationBlocker(location) : "";
  const title = narrowed ? "Nicio cerere pentru aceste filtre" : filter === "unread" ? "Nicio conversație necitită" : filter === "history" ? "Nicio cerere încheiată" : blocker ? "Locația nu primește cereri noi" : "Încă nu ai cereri";
  const description = narrowed ? "Încearcă altă căutare sau schimbă filtrele." : filter === "unread" ? (entitlement?.plan_code === "free" ? "Conversațiile sunt disponibile pentru locațiile Pro eligibile. Cererile noi se văd în Active." : "Conversațiile cu mesaje noi vor apărea aici.") : filter === "history" ? "Cererile încheiate și expirate vor apărea aici." : blocker || "Cererile potrivite apar după ce clientul aprobă distribuirea către locația ta.";
  const action = blocker ? onOpenLocation || onOpenRequestSettings : null;
  return <div className="inbox-empty"><span className="inbox-empty-icon" aria-hidden="true">{narrowed ? <Search /> : <Inbox />}</span><strong>{title}</strong><p>{description}</p>{action && <button type="button" className="inbox-button" onClick={action}>Verifică locația</button>}{blocker && !action && <p className="inbox-empty-hint">Administratorul organizației poate verifica locația și accesul.</p>}</div>;
}
