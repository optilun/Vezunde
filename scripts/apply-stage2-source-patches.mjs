import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, replacements) {
  let content = await readFile(path, 'utf8');
  for (const [before, after, label] of replacements) {
    if (!content.includes(before)) {
      throw new Error(`Missing patch anchor in ${path}: ${label}`);
    }
    content = content.replace(before, after);
  }
  await writeFile(path, content);
}

await patchFile('src/components/workspace/provider/ProviderServices.jsx', [
  [
    'import { ChevronDown, Plus, Save, Send, X } from "lucide-react";',
    'import { AlertTriangle, CheckCircle2, ChevronDown, Plus, Save, Send, ShieldCheck, X } from "lucide-react";',
    'provider icons',
  ],
  [
    'function ServiceGroupBlock({ group, items, selected, pendingReview, onToggle }) {',
    `function PrerequisiteBadge({ prerequisite }) {
  if (!prerequisite || prerequisite.status === "available") return null;
  const ready = prerequisite.eligible === true;
  const Icon = ready ? CheckCircle2 : AlertTriangle;
  return (
    <span className={\`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold \${ready ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}\`}>
      <Icon className="h-3 w-3" /> {prerequisite.status_label || prerequisite.status}
    </span>
  );
}

function ServiceGroupBlock({ group, items, selected, prerequisitesByKey, pendingReview, onToggle }) {`,
    'prerequisite badge component',
  ],
  [
    '          const active = (selected[item.group] || []).includes(item.id);\n          return (',
    '          const active = (selected[item.group] || []).includes(item.id);\n          const prerequisite = prerequisitesByKey[item.id] || null;\n          const incompatible = prerequisite?.status === "incompatible_profile";\n          return (',
    'service prerequisite lookup',
  ],
  [
    '              disabled={pendingReview}\n              onClick={() => onToggle(item.group, item.id)}',
    '              disabled={pendingReview || incompatible}\n              onClick={() => onToggle(item.group, item.id)}',
    'disable incompatible service',
  ],
  [
    '              {label}\n            </button>',
    `              <span className="flex flex-col items-start">
                <span>{label}</span>
                <PrerequisiteBadge prerequisite={prerequisite} />
              </span>
            </button>`,
    'render provider prerequisite status',
  ],
  [
    'function NeedSectionCard({ section, selected, customByGroup, pendingReview, onToggle, onAddCustom, onRemoveCustom }) {',
    'function NeedSectionCard({ section, selected, customByGroup, prerequisitesByKey, pendingReview, onToggle, onAddCustom, onRemoveCustom }) {',
    'need section prerequisites prop',
  ],
  [
    '<ServiceGroupBlock key={group} group={group} items={items} selected={selected} pendingReview={pendingReview} onToggle={onToggle} />',
    '<ServiceGroupBlock key={group} group={group} items={items} selected={selected} prerequisitesByKey={prerequisitesByKey} pendingReview={pendingReview} onToggle={onToggle} />',
    'primary prerequisite props',
  ],
  [
    '<ServiceGroupBlock key={group} group={group} items={items} selected={selected} pendingReview={pendingReview} onToggle={onToggle} />',
    '<ServiceGroupBlock key={group} group={group} items={items} selected={selected} prerequisitesByKey={prerequisitesByKey} pendingReview={pendingReview} onToggle={onToggle} />',
    'optional prerequisite props',
  ],
  [
    '  const [legacyServices, setLegacyServices] = useState([]);\n  const [rawRemovalKeys, setRawRemovalKeys] = useState([]);',
    '  const [legacyServices, setLegacyServices] = useState([]);\n  const [prerequisitesByKey, setPrerequisitesByKey] = useState({});\n  const [rawRemovalKeys, setRawRemovalKeys] = useState([]);',
    'provider prerequisite state',
  ],
  [
    '  const hasChanges = hasSelectionChanges || customRequests.length > 0 || hasRawRemovalChanges || rawRemovalKeys.length > 0;\n\n  const customByGroup = useMemo(() => {',
    `  const hasChanges = hasSelectionChanges || customRequests.length > 0 || hasRawRemovalChanges || rawRemovalKeys.length > 0;
  const selectedPrerequisiteRows = Object.values(selected || {}).flat()
    .map((key) => prerequisitesByKey[key])
    .filter(Boolean);
  const blockedSelectedCount = selectedPrerequisiteRows.filter((item) => item.eligible === false).length;
  const readyForReviewCount = selectedPrerequisiteRows.filter((item) => item.eligible === true && item.status === "ready_for_review").length;

  const customByGroup = useMemo(() => {`,
    'provider prerequisite counts',
  ],
  [
    '      setCustomRequests([]);\n      setLegacyServices([]);\n      setRawRemovalKeys([]);',
    '      setCustomRequests([]);\n      setLegacyServices([]);\n      setPrerequisitesByKey({});\n      setRawRemovalKeys([]);',
    'reset prerequisite state',
  ],
  [
    '    setLegacyServices(Array.isArray(serviceResult.data.legacy_or_unknown_services) ? serviceResult.data.legacy_or_unknown_services : []);\n    setRawRemovalKeys(Array.isArray(payload.raw_removal_keys) ? payload.raw_removal_keys : []);',
    '    setLegacyServices(Array.isArray(serviceResult.data.legacy_or_unknown_services) ? serviceResult.data.legacy_or_unknown_services : []);\n    setPrerequisitesByKey(serviceResult.data.prerequisites_by_key || {});\n    setRawRemovalKeys(Array.isArray(payload.raw_removal_keys) ? payload.raw_removal_keys : []);',
    'load prerequisite state',
  ],
  [
    '          {removalCount > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">{removalCount} de eliminat</span>}',
    `          {removalCount > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">{removalCount} de eliminat</span>}
          {readyForReviewCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 font-semibold text-green-800"><ShieldCheck className="h-3 w-3" />{readyForReviewCount} pregătite pentru verificare</span>}
          {blockedSelectedCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" />{blockedSelectedCount} cu cerințe lipsă</span>}`,
    'provider prerequisite header summary',
  ],
  [
    '      {loading && <div className="rounded-2xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">Se încarcă serviciile locației...</div>}',
    `      {!pendingReview && blockedSelectedCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Unele servicii selectate necesită încă specialist, echipament sau infrastructură verificată. Le poți păstra în draft, dar nu vor putea fi aprobate ori publicate până la completarea cerințelor.
        </div>
      )}

      {loading && <div className="rounded-2xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">Se încarcă serviciile locației...</div>}`,
    'provider prerequisite warning',
  ],
  [
    '              customByGroup={customByGroup}\n              pendingReview={pendingReview}',
    '              customByGroup={customByGroup}\n              prerequisitesByKey={prerequisitesByKey}\n              pendingReview={pendingReview}',
    'active section prerequisite props',
  ],
]);

await patchFile('base44/functions/profileFoundationOps/entry.ts', [
  [
    "  'autorefractometer', 'keratometer', 'lensmeter', 'phoropter', 'visual_acuity_chart',",
    "  'autorefractometer', 'keratometer', 'lensmeter', 'phoropter', 'visual_acuity_chart', 'pupillometer', 'digital_centering_system',",
    'optical measurement equipment keys',
  ],
  [
    "  'slit_lamp', 'tonometer', 'corneal_topographer', 'contact_lens_trial_set',",
    "  'slit_lamp', 'tonometer', 'corneal_topographer', 'contact_lens_trial_set', 'gonioscope', 'specular_microscope', 'retinal_angiography_system',",
    'clinical equipment keys',
  ],
  [
    "  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser',",
    "  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser', 'retinal_laser', 'intravitreal_injection_setup', 'minor_procedure_set',",
    'procedure equipment keys',
  ],
  [
    "  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'ophthalmic_ultrasound',\n  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser',",
    "  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'ophthalmic_ultrasound', 'gonioscope', 'specular_microscope', 'retinal_angiography_system',\n  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser', 'retinal_laser', 'intravitreal_injection_setup', 'minor_procedure_set',",
    'specialized equipment verification keys',
  ],
]);

console.log('Stage 2 source patches applied.');
