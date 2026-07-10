import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public read-only provider profile endpoint.
// Returns only whitelisted public data.

const PUBLIC_CONF = ['publicly_listed', 'provider_confirmed', 'vezunde_verified'];
const PATIENT_FACING_PROFILE_TYPES = ['independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office'];

const SERVICE_LABELS = {
  eyeglasses: 'Ochelari de vedere',
  frames: 'Rame de ochelari',
  prescription_lenses: 'Lentile pentru ochelari',
  sunglasses: 'Ochelari de soare',
  prescription_sunglasses: 'Ochelari de soare cu dioptrii',
  children_frames: 'Rame pentru copii',
  sports_glasses: 'Ochelari sport',
  safety_glasses: 'Ochelari de protectie',
  accessories: 'Accesorii pentru ochelari',
  single_vision_lenses: 'Lentile monofocale',
  progressive_lenses: 'Lentile progresive',
  office_lenses: 'Lentile office / intermediare',
  reading_lenses: 'Lentile pentru aproape',
  thin_lenses: 'Lentile subtiate',
  photochromic_lenses: 'Lentile heliomate',
  polarized_lenses: 'Lentile polarizate',
  blue_light_lenses: 'Protectie pentru lumina albastra',
  prism_lenses: 'Lentile prismatice',
  pd_measurement: 'Masurare distanta pupilara',
  digital_centering: 'Centrare digitala a lentilelor',
  optometry_consultation: 'Consult optometric',
  visual_acuity_test: 'Test de acuitate vizuala',
  refraction: 'Determinare dioptrii',
  autorefractometry: 'Autorefractometrie',
  binocular_vision: 'Evaluare vedere binoculara',
  dry_eye_screening: 'Screening pentru ochi uscat',
  color_vision_test: 'Test pentru vedere cromatica',
  occupational_vision: 'Evaluare vizuala pentru activitate profesionala',
  contact_lenses: 'Lentile de contact',
  contact_lens_consultation: 'Consult pentru lentile de contact',
  contact_lens_fitting: 'Adaptare lentile de contact',
  contact_lens_trial: 'Proba lentile de contact',
  toric_contact_lenses: 'Lentile de contact torice',
  multifocal_contact_lenses: 'Lentile de contact multifocale',
  rgp_lenses: 'Lentile rigide gaz-permeabile',
  scleral_lenses: 'Lentile sclerale',
  contact_lens_followup: 'Control pentru lentile de contact',
  ophthalmology_consultation: 'Consult oftalmologic',
  complete_eye_exam: 'Examinare oftalmologica completa',
  prescription_check: 'Verificare reteta pentru ochelari',
  eye_pressure_check: 'Masurare tensiune intraoculara',
  fundus_exam: 'Examinare fund de ochi',
  anterior_segment_exam: 'Examinare segment anterior',
  followup_consultation: 'Control oftalmologic',
  second_opinion: 'A doua opinie medicala',
  oct: 'OCT',
  visual_field_analyzer: 'Camp vizual',
  fundus_camera: 'Fotografie fund de ochi',
  pachymeter: 'Pahimetrie',
  biometer: 'Biometrie',
  corneal_topography: 'Topografie corneana',
  keratometry: 'Keratometrie',
  tonometry: 'Tonometrie',
  gonioscopy: 'Gonioscopie',
  ultrasound: 'Ecografie oculara',
  specular_microscopy: 'Microscopie speculara',
  angiography: 'Angiografie retiniana',
  retina_consultation: 'Retina',
  glaucoma_consultation: 'Glaucom',
  cataract_consultation: 'Cataracta',
  cornea_consultation: 'Cornee',
  pediatric_ophthalmology: 'Oftalmologie pediatrica',
  strabismus: 'Strabism',
  neuro_ophthalmology: 'Neuro-oftalmologie',
  uveitis: 'Uveita',
  myopia_management: 'Managementul miopiei',
  dry_eye_management: 'Managementul ochiului uscat',
  diabetic_retinopathy: 'Retinopatie diabetica',
  macular_degeneration: 'Degenerescenta maculara',
  emergency_ophthalmology: 'Urgente oftalmologice',
  cataract_surgery: 'Chirurgie cataracta',
  refractive_surgery: 'Chirurgie refractiva',
  laser_procedures: 'Proceduri laser',
  yag_laser: 'Laser YAG',
  retinal_laser: 'Laser retinian',
  intravitreal_injections: 'Injectii intravitreene',
  eyelid_surgery: 'Chirurgie pleoape',
  chalazion_treatment: 'Tratament salazion',
  minor_eye_procedures: 'Proceduri oftalmologice minore',
  children_eye_exam: 'Consult copii',
  pediatric_refraction: 'Determinare dioptrii copii',
  amblyopia_screening: 'Screening ambliopie',
  strabismus_screening: 'Screening strabism',
  school_screening: 'Screening scolar',
  myopia_control_children: 'Control miopie copii',
  vision_therapy: 'Terapie vizuala',
  eyeglasses_adjustment: 'Reglaj ochelari',
  eyeglasses_repair: 'Reparatii ochelari',
  lens_fitting: 'Montaj lentile',
  frame_repair: 'Reparatii rame',
  screw_replacement: 'Inlocuire suruburi / pernute',
  lens_replacement: 'Inlocuire lentile in rama existenta',
  frame_cleaning: 'Curatare ochelari',
  workshop_orders: 'Comenzi atelier optic',
};

const GENERAL_KEYS = [
  'eyeglasses', 'frames', 'prescription_lenses', 'sunglasses', 'prescription_sunglasses', 'children_frames', 'sports_glasses', 'safety_glasses', 'accessories',
  'single_vision_lenses', 'progressive_lenses', 'office_lenses', 'reading_lenses', 'thin_lenses', 'photochromic_lenses', 'polarized_lenses', 'blue_light_lenses', 'prism_lenses', 'pd_measurement', 'digital_centering',
  'optometry_consultation', 'visual_acuity_test', 'refraction', 'autorefractometry', 'binocular_vision', 'dry_eye_screening', 'color_vision_test', 'occupational_vision',
  'contact_lenses', 'contact_lens_consultation', 'contact_lens_fitting', 'contact_lens_trial', 'toric_contact_lenses', 'multifocal_contact_lenses', 'rgp_lenses', 'scleral_lenses', 'contact_lens_followup',
];
const TECHNICAL_KEYS = ['eyeglasses_adjustment', 'eyeglasses_repair', 'lens_fitting', 'frame_repair', 'screw_replacement', 'lens_replacement', 'frame_cleaning', 'workshop_orders'];
const SPECIALIZED_KEYS = [
  'ophthalmology_consultation', 'complete_eye_exam', 'prescription_check', 'eye_pressure_check', 'fundus_exam', 'anterior_segment_exam', 'followup_consultation', 'second_opinion',
  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'corneal_topography', 'keratometry', 'tonometry', 'gonioscopy', 'ultrasound', 'specular_microscopy', 'angiography',
  'retina_consultation', 'glaucoma_consultation', 'cataract_consultation', 'cornea_consultation', 'pediatric_ophthalmology', 'strabismus', 'neuro_ophthalmology', 'uveitis', 'myopia_management', 'dry_eye_management', 'diabetic_retinopathy', 'macular_degeneration', 'emergency_ophthalmology',
  'cataract_surgery', 'refractive_surgery', 'laser_procedures', 'yag_laser', 'retinal_laser', 'intravitreal_injections', 'eyelid_surgery', 'chalazion_treatment', 'minor_eye_procedures',
  'children_eye_exam', 'pediatric_refraction', 'amblyopia_screening', 'strabismus_screening', 'school_screening', 'myopia_control_children', 'vision_therapy',
];
const NEED_LEVELS = Object.fromEntries([
  ...GENERAL_KEYS.map((key) => [key, 'general']),
  ...TECHNICAL_KEYS.map((key) => [key, 'technical']),
  ...SPECIALIZED_KEYS.map((key) => [key, 'specialized_medical']),
]);

const STATUS_LABELS = {
  verified: 'Profil verificat de Vezunde',
  claimed: 'Profil revendicat',
  directory: 'Profil din director',
};

const AVAILABILITY_LABELS = {
  astazi: 'Primeste clienti fara programare',
  urmatoarele_zile: 'Primeste clienti si cu programare',
  saptamana_aceasta: 'Walk-in pentru optica, programare pentru consultatii',
  doar_programare: 'Doar cu programare',
};

const AVAILABILITY_STALE_DAYS = 30;

function isPublicSafeService(s, pcs) {
  if (s.is_active === false) return false;
  if (s.migration_review_required) return false;
  if (!PUBLIC_CONF.includes(s.confirmation_level)) return false;
  const level = (s.is_advanced_service || s.service_need_level === 'specialized_medical') ? 'specialized_medical' : (NEED_LEVELS[s.service_key] || 'unknown');
  if (level === 'specialized_medical' || level === 'unknown') return s.confirmation_level === 'vezunde_verified' && pcs === 'verified';
  return true;
}

function toPublicService(s) {
  return { key: s.service_key, label: SERVICE_LABELS[s.service_key] || s.service_key };
}

function publicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/\s/.test(raw)) return null;
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch (_e) {
    return null;
  }
}

function publicImage(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.length <= 800000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  return publicUrl(raw);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const locationId = payload.location_id ? String(payload.location_id) : null;
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    const pcs = loc ? (loc.profile_control_status || 'directory') : null;
    if (!loc || loc.status !== 'publicata' || loc.active_status === 'inactiva' || pcs === 'suspended'
        || !loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) {
      return Response.json({ error: 'Profilul nu a fost gasit' }, { status: 404 });
    }

    const [services, assigns] = await Promise.all([
      svc.entities.LocationService.filter({ location_id: loc.id }, null, 300),
      svc.entities.ProfessionalLocationAssignment.filter({ location_id: loc.id, active_status: 'activ', public_status: 'public' }, null, 100),
    ]);

    const publicServices = services
      .filter((s) => isPublicSafeService(s, pcs))
      .map(toPublicService);

    const profiles = await Promise.all(assigns.map((assignment) => svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null)));
    const team = assigns.map((assignment, index) => {
      const profile = profiles[index];
      if (!profile) return null;
      if (profile.is_public !== true) return null;
      if (profile.verification_status !== 'verified') return null;
      if (profile.public_visibility_status !== 'approved') return null;
      const displayName = profile.public_display_name || profile.full_name;
      if (!displayName) return null;
      return {
        id: profile.id,
        full_name: displayName,
        professional_type: profile.professional_type || assignment.professional_type,
        bio: profile.professional_bio || profile.bio || null,
        profile_photo_url: publicImage(profile.profile_photo_url),
        specializations: Array.isArray(profile.specializations) ? profile.specializations.slice(0, 6) : [],
        verified: true,
      };
    }).filter(Boolean);

    let availabilityLabel = null;
    if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
      const ageDays = (Date.now() - new Date(loc.availability_updated_at).getTime()) / 86400000;
      if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
    }

    return Response.json({
      profile: {
        id: loc.id,
        name: loc.public_display_name || loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        city: loc.city,
        county: loc.county || null,
        address: loc.address || null,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
        place_id: loc.place_id || null,
        phone_public: loc.public_phone || loc.phone_public || null,
        public_email: loc.public_email || null,
        website: publicUrl(loc.website_url || loc.website),
        facebook: publicUrl(loc.facebook_url),
        instagram: publicUrl(loc.instagram_url),
        linkedin: publicUrl(loc.linkedin_url),
        description: loc.public_description || loc.description || null,
        photo_url: loc.photo_url || null,
        opening_hours: loc.opening_hours || null,
        saturday_hours: loc.saturday_hours || null,
        profile_control_status: pcs,
        status_label: STATUS_LABELS[pcs] || STATUS_LABELS.directory,
        availability_label: availabilityLabel,
        services: publicServices,
        team,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
