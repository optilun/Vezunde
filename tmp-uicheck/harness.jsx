import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Unsubscribe from '@/pages/Unsubscribe';
import OutreachRecipientPicker from '@/components/admin/outreach/OutreachRecipientPicker';
import OutreachCampaignDetail from '@/components/admin/outreach/OutreachCampaignDetail';
import OutreachAudienceBuilder from '@/components/admin/outreach/OutreachAudienceBuilder';

function Picker() {
  const [spec, setSpec] = useState({ category: 'announcement', audience_sources: ['directory', 'provider_account'], excluded_contact_ids: [], included_contact_ids: [] });
  window.__spec = spec;
  return <OutreachRecipientPicker spec={spec} onChange={(patch) => setSpec((s) => ({ ...s, ...patch }))} />;
}
function Builder() {
  const [filters, setFilters] = useState({ target_counties: [], target_tags: [] });
  window.__filters = filters;
  return <OutreachAudienceBuilder filters={filters} onChange={setFilters} />;
}
function App() {
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'unsub') return <MemoryRouter initialEntries={['/dezabonare?t=tok123']}><Routes><Route path="/dezabonare" element={<Unsubscribe />} /></Routes></MemoryRouter>;
  if (view === 'picker') return <Picker />;
  if (view === 'builder') return <Builder />;
  if (view === 'failed') return <MemoryRouter><OutreachCampaignDetail campaignId="k3" onBack={() => {}} /></MemoryRouter>;
  if (view === 'retry') return <MemoryRouter><OutreachCampaignDetail campaignId="k4" onBack={() => {}} /></MemoryRouter>;
  return <div>no view</div>;
}
window.addEventListener('error', (e) => { (window.__errors ||= []).push(String(e.message)); });
createRoot(document.getElementById('root')).render(<App />);
