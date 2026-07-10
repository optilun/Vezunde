import { readFile, writeFile } from 'node:fs/promises';

const path = 'base44/functions/profileFoundationOps/entry.ts';
let content = await readFile(path, 'utf8');

const equipmentKeys = `const EQUIPMENT_KEYS = [
  'autorefractometer', 'keratometer', 'lensmeter', 'phoropter', 'visual_acuity_chart',
  'pupillometer', 'digital_centering_system',
  'slit_lamp', 'tonometer', 'corneal_topographer', 'contact_lens_trial_set',
  'gonioscope', 'specular_microscope', 'retinal_angiography_system',
  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'ophthalmic_ultrasound',
  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser',
  'retinal_laser', 'intravitreal_injection_setup', 'minor_procedure_set',
  'excimer_laser', 'femtosecond_laser', 'corneal_crosslinking_system',
  'tracer', 'blocker', 'edger', 'groover', 'drill', 'generator', 'polisher', 'coater', 'ultrasonic_cleaner',
];`;

const specializedEquipment = `const SPECIALIZED_EQUIPMENT = [
  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'ophthalmic_ultrasound',
  'gonioscope', 'specular_microscope', 'retinal_angiography_system',
  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser',
  'retinal_laser', 'intravitreal_injection_setup', 'minor_procedure_set',
  'excimer_laser', 'femtosecond_laser', 'corneal_crosslinking_system',
];`;

const equipmentPattern = /const EQUIPMENT_KEYS = \[[\s\S]*?\n\];/;
const specializedPattern = /const SPECIALIZED_EQUIPMENT = \[[\s\S]*?\n\];/;

if (!equipmentPattern.test(content)) throw new Error('EQUIPMENT_KEYS block not found');
if (!specializedPattern.test(content)) throw new Error('SPECIALIZED_EQUIPMENT block not found');

content = content.replace(equipmentPattern, equipmentKeys);
content = content.replace(specializedPattern, specializedEquipment);
await writeFile(path, content);

console.log('Stage 2 equipment catalogs normalized.');
