import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OutreachCampaignList from '@/components/admin/outreach/OutreachCampaignList';
import OutreachCampaignDetail from '@/components/admin/outreach/OutreachCampaignDetail';
import OutreachTemplateEditor from '@/components/admin/outreach/OutreachTemplateEditor';
function App() {
  const view = new URLSearchParams(location.search).get('view') || 'list';
  const [selected, setSelected] = useState(null);
  return (
    <div className="mx-auto max-w-6xl bg-background p-6 text-foreground">
      {view === 'list' && !selected && <OutreachCampaignList onSelect={setSelected} />}
      {view === 'list' && selected && <OutreachCampaignDetail campaignId={selected} onBack={() => setSelected(null)} />}
      {view === 'draft' && <OutreachCampaignDetail campaignId="k1" onBack={() => {}} />}
      {view === 'sending' && <OutreachCampaignDetail campaignId="k2" onBack={() => {}} />}
      {view === 'templates' && <OutreachTemplateEditor />}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
