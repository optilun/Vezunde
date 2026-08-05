import { createClient } from '@base44/sdk';

const base44 = createClient({
  appId: '6a48cb9d04fa7f999d8a8054',
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: 'https://base44.app',
});

// Fraze romanesti tipice de pacient, informale, acoperind toate cele 4 zone:
// general (rutina), tehnic (ochelari), medical necritic, si semnale de siguranta.
const cases = [
  { label: 'control rutina informal', text: 'vreau sa fac un control la ochi, nu am mai fost de mult' },
  { label: 'ochelari, colocvial', text: 'am nevoie de ochelari noi, mi s-au spart astia vechi' },
  { label: 'lentile de contact', text: 'vreau sa incerc lentile de contact, port ochelari acum' },
  { label: 'simptom vag, nu urgenta', text: 'imi lacrimeaza ochiul stang de cateva zile, e enervant' },
  { label: 'copil, control scoala', text: 'copilul meu de 8 ani trebuie sa faca un control de vedere pentru scoala' },
  { label: 'ambiguu — obosit vs medical', text: 'ma doare capul si mi se incetoseaza vederea seara cand citesc' },
  { label: 'SIGURANTA — durere severa+greata', text: 'ma doare ochiul foarte tare, mi-e greata si am dureri de cap ingrozitoare de o ora' },
  { label: 'SIGURANTA — chimic', text: 'mi-a sarit inalbitor in ochi acum cateva minute' },
  { label: 'SIGURANTA — pierdere vedere', text: 'nu mai vad deloc cu un ochi, s-a intamplat brusc acum o ora' },
  { label: 'reparatie ochelari', text: 'mi s-a rupt bratul la ochelari, poate fi reparat?' },
];

for (const c of cases) {
  try {
    const res = await base44.functions.invoke('matchProvidersSemantic', {
      search_text: c.text,
      locality_siruta_code: null,
      limit: 5,
    });
    const d = res.data || {};
    console.log(JSON.stringify({
      case: c.label,
      input: c.text,
      need_level: d.need_level,
      resolved_service_keys: d.resolved_service_keys,
      semantic_resolution: d.semantic_resolution,
      coverage_status: d.coverage_status,
    }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ case: c.label, error: String(err?.message || err) }));
  }
  console.log('---');
}
