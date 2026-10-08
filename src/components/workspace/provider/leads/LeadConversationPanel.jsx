import React from "react";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import ProviderLeadChat from "../ProviderLeadChat";

const RESPONSES = [["can_help", "Putem ajuta"], ["needs_details", "Avem nevoie de detalii"], ["cannot_help", "Nu putem ajuta"]];

export default function LeadConversationPanel({ lead, locationId, entitlement, loading, responding, onRespond, onBack, onDetails, onChatChanged, readVisible = true }) {
  if (!lead) return <div className="inbox-conversation"><div className="inbox-empty"><strong>Alege o cerere</strong>Conversația și răspunsul locației apar aici.</div></div>;
  const response = lead.provider_response;
  const terminal = lead.is_historical === true;
  const canRespond = entitlement?.plan_code === "pro" && entitlement.feature_keys?.includes("provider_leads.respond");
  const canChat = entitlement?.plan_code === "pro" && entitlement.feature_keys?.includes("provider_chat.access") && lead.access_tier === "pro_full";
  const responseEligible = ["can_help", "needs_details"].includes(response?.response_type);
  return <div className="inbox-conversation" id={`provider-lead-${lead.id}`}>
    <header className="inbox-conversation-header">
      <button type="button" className="inbox-button inbox-back" onClick={onBack} aria-label="Înapoi la cereri"><ArrowLeft /></button>
      <div className="min-w-0 flex-1"><h2>{lead.intent_label || "Cerere client"}</h2><p>{terminal ? "Cerere încheiată · doar consultare" : response?.response_label || "Așteaptă răspunsul locației"}</p></div>
      <button type="button" className="inbox-button inbox-detail-button" onClick={onDetails}><Info /> Detalii</button>
    </header>
    {!terminal && <div className="inbox-response">
      {canRespond ? RESPONSES.map(([key, label]) => <button key={key} type="button" className="inbox-button" aria-pressed={response?.response_type === key} disabled={responding || loading} onClick={() => onRespond(lead.id, key)}>{label}</button>) : <p>Răspunsurile și conversațiile sunt disponibile pentru locațiile Pro eligibile.</p>}
      {canRespond && <p>Răspunsul nu deschide automat conversația. Clientul inițiază chatul.</p>}
    </div>}
    <div className="inbox-chat">
      {loading ? <div className="inbox-empty" role="status"><Loader2 className="mx-auto animate-spin" /> Se încarcă cererea…</div>
        : canChat && responseEligible ? <ProviderLeadChat leadId={lead.id} locationId={locationId} enabled={canChat} responseType={response.response_type} terminal={terminal} fullHeight onChanged={onChatChanged} readVisible={readVisible} />
        : <div className="inbox-empty"><strong>{terminal ? "Istoric cerere" : "Conversația nu este deschisă"}</strong>{canRespond && !responseEligible && !terminal ? "Transmite un răspuns eligibil: Putem ajuta sau Avem nevoie de detalii. Clientul poate apoi deschide conversația." : "Accesul la chat depinde de Pro, Top 3 și acordul activ al clientului. Telefonul se aprobă separat."}</div>}
    </div>
  </div>;
}
