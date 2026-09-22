import React, { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { callOutreach, SOURCE_LABELS } from "./outreachLabels";

// Pasul "Previzualizare si test": emailul exact, compus de backend cu acelasi cod ca trimiterea
// reala (render_preview), pentru un destinatar ales din lista. Testul pleaca doar la adresa scrisa
// aici, dar cu datele destinatarului ales, ca sa vezi in Gmail/Outlook exact ce primeste el.

const AUDIENCE_KEYS = [
  "category", "audience_sources", "audience_mode", "included_contact_ids", "excluded_contact_ids",
  "target_counties", "target_provider_types", "target_profile_control_status", "target_tags", "target_email_scope",
];

export default function OutreachEmailPreview({ campaignId, draft, onBeforeTest }) {
  const [recipients, setRecipients] = useState([]);
  const [contactId, setContactId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    let active = true;
    const payload = Object.fromEntries(AUDIENCE_KEYS.map((key) => [key, draft[key]]));
    callOutreach("outreachCampaignOps", "list_recipients", payload).then((data) => {
      if (!active || data.error) return;
      const eligible = (data.rows || []).filter((row) => !row.excluded && !row.reason).slice(0, 200);
      setRecipients(eligible);
      if (eligible.length && !contactId) setContactId(eligible[0].id);
    });
    return () => { active = false; };
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const data = await callOutreach("outreachCampaignOps", "render_preview", {
        id: campaignId,
        contact_id: contactId,
        category: draft.category,
        subject: draft.subject,
        body_html: draft.body_html,
        cta_label: draft.cta_label,
        cta_url: draft.cta_url,
        show_listing_preview: draft.show_listing_preview,
      });
      if (!active) return;
      setLoading(false);
      if (data.error) { setError(data.error); return; }
      setError("");
      setPreview(data);
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [campaignId, contactId, draft.category, draft.subject, draft.body_html, draft.cta_label, draft.cta_url, draft.show_listing_preview]);

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestStatus("Se trimite...");
    if (onBeforeTest) {
      const saved = await onBeforeTest();
      if (saved === false) { setTestStatus("Nu am putut salva ciorna inainte de test."); return; }
    }
    const data = await callOutreach("outreachSendOps", "send_test_email", {
      campaign_id: campaignId,
      to_email: testEmail.trim(),
      sample_contact_id: contactId || "",
    });
    setTestStatus(data.error ? `Eroare: ${data.error}` : `Trimis la ${testEmail.trim()}. Verifica si folderul Spam.`);
  };

  const chosen = recipients.find((row) => row.id === contactId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[240px] flex-1">
          <span className="text-xs font-semibold text-foreground">Cum il vede</span>
          <select
            id="outreach-preview-recipient"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">Un exemplu (Optica Exemplu, Bucuresti)</option>
            {recipients.map((row) => (
              <option key={row.id} value={row.id}>
                {row.company_name || row.email} — {row.email}{row.city ? `, ${row.city}` : ""}
              </option>
            ))}
          </select>
        </label>
        {chosen && <span className="pb-2 text-[11px] text-muted-foreground">Sursa: {SOURCE_LABELS[chosen.kind]}</span>}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="rounded-2xl border border-border bg-secondary/40 p-3">
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          Subiect: <strong className="text-foreground">{preview?.subject || draft.subject || "—"}</strong>
          {loading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
        </p>
        {preview?.html ? (
          <iframe
            title="Previzualizare email"
            sandbox=""
            srcDoc={preview.html}
            className="h-[760px] w-full rounded-xl border border-border bg-white"
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Se pregateste previzualizarea...</div>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
        <p className="text-xs font-semibold text-foreground">Trimite un test</p>
        <p className="text-[11px] text-muted-foreground">Pleaca doar la adresa de mai jos, cu datele destinatarului ales mai sus. Ciorna se salveaza inainte.</p>
        <div className="flex flex-wrap gap-2">
          <input
            id="outreach-test-email"
            type="email"
            placeholder="adresa@exemplu.ro"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="min-w-[220px] rounded-lg border border-border px-3 py-1.5 text-xs"
          />
          <button type="button" onClick={sendTest} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
            <Send className="h-3 w-3" /> Trimite test
          </button>
        </div>
        {testStatus && <p className="text-[11px] text-muted-foreground">{testStatus}</p>}
      </div>
    </div>
  );
}
