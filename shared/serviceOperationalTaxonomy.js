import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
} from './canonicalServiceRegistry.js';

// Provider-facing sections. Every canonical key must belong to exactly one section.
// Sections point to a physical unit and, when applicable, to an operational capability.
export const PROVIDER_SERVICE_SECTIONS = [
  {
    key: 'optical_products', unitKey: 'optical_store', capabilityKey: null,
    area: 'products', kind: 'product', title: 'Rame, ochelari și accesorii',
    publicNeedKey: 'glasses_frames', publicLabel: 'Ochelari și rame',
    description: 'Produsele pe care clienții le pot găsi și cumpăra în această locație.',
    searchTerms: ['ochelari', 'rame', 'rame vedere', 'accesorii ochelari'],
    items: [
      ['optical_retail', 'eyeglasses'], ['optical_retail', 'frames'], ['optical_retail', 'prescription_lenses'],
      ['optical_retail', 'children_frames'], ['optical_retail', 'accessories'],
    ],
  },
  {
    key: 'sun_and_protection', unitKey: 'optical_store', capabilityKey: null,
    area: 'products', kind: 'product', title: 'Ochelari de soare și protecție',
    publicNeedKey: 'sun_protection', publicLabel: 'Ochelari de soare și protecție',
    description: 'Produse de soare, sport și protecție, cu sau fără dioptrii.',
    searchTerms: ['ochelari soare', 'ochelari protectie', 'ochelari sport', 'soare cu dioptrii'],
    items: [
      ['optical_retail', 'sunglasses'], ['optical_retail', 'prescription_sunglasses'],
      ['optical_retail', 'sports_glasses'], ['optical_retail', 'safety_glasses'],
    ],
  },
  {
    key: 'ophthalmic_lenses', unitKey: 'optical_cabinet', fallbackUnitKeys: ['optical_store', 'optical_laboratory'], capabilityKey: null,
    area: 'products', kind: 'product_option', title: 'Lentile oftalmice',
    publicNeedKey: 'ophthalmic_lenses', publicLabel: 'Lentile pentru ochelari',
    description: 'Tipurile și opțiunile de lentile pentru ochelari disponibile în ofertă.',
    searchTerms: ['lentile ochelari', 'lentile progresive', 'lentile subtiri', 'lentile fotocromatice'],
    items: [
      ['lenses_and_measurements', 'single_vision_lenses'], ['lenses_and_measurements', 'progressive_lenses'],
      ['lenses_and_measurements', 'office_lenses'], ['lenses_and_measurements', 'reading_lenses'],
      ['lenses_and_measurements', 'thin_lenses'], ['lenses_and_measurements', 'photochromic_lenses'],
      ['lenses_and_measurements', 'polarized_lenses'], ['lenses_and_measurements', 'blue_light_lenses'],
      ['lenses_and_measurements', 'prism_lenses'],
    ],
  },
  {
    key: 'optical_measurements', unitKey: 'optical_cabinet', fallbackUnitKeys: ['optometry_cabinet'], capabilityKey: null,
    area: 'professional_services', kind: 'measurement', title: 'Măsurători și centrare',
    publicNeedKey: 'optical_measurements', publicLabel: 'Măsurători și centrare',
    description: 'Măsurători realizate pentru alegerea și montajul corect al lentilelor.',
    searchTerms: ['distanta pupilara', 'pd', 'centrare lentile', 'centrare digitala'],
    items: [
      ['lenses_and_measurements', 'pd_measurement'], ['lenses_and_measurements', 'digital_centering'],
    ],
  },
  {
    key: 'optometry', unitKey: 'optometry_cabinet', capabilityKey: null,
    area: 'professional_services', kind: 'professional_service', title: 'Evaluarea vederii și dioptriilor',
    publicNeedKey: 'eye_exam', publicLabel: 'Control vedere și dioptrii',
    description: 'Servicii realizate în cabinetul optometric de un specialist compatibil.',
    note: 'Eligibilitatea depinde de specialistul asociat și de dotările declarate ale cabinetului.',
    searchTerms: ['control vedere', 'verificare vedere', 'masurat dioptrii', 'test vedere', 'control ochi', 'optometrist'],
    items: [
      ['optometry', 'optometry_consultation'], ['optometry', 'visual_acuity_test'], ['optometry', 'refraction'],
      ['optometry', 'autorefractometry'], ['optometry', 'binocular_vision'], ['optometry', 'dry_eye_screening'],
      ['optometry', 'color_vision_test'], ['optometry', 'occupational_vision'],
    ],
  },
  {
    key: 'contact_lens_products', unitKey: 'optical_store', capabilityKey: 'contact_lens_sales',
    area: 'products', kind: 'product', title: 'Produse pentru lentile de contact',
    publicNeedKey: 'contact_lens_products', publicLabel: 'Lentile de contact',
    description: 'Lentile și produse de întreținere disponibile pentru cumpărare.',
    searchTerms: ['lentile contact', 'solutie lentile', 'lentile torice', 'lentile multifocale', 'lentile rigide'],
    items: [
      ['contact_lenses', 'contact_lenses'], ['contact_lenses', 'toric_contact_lenses'],
      ['contact_lenses', 'multifocal_contact_lenses'], ['contact_lenses', 'rgp_lenses'],
      ['contact_lenses', 'scleral_lenses'], ['contact_lenses', 'contact_lens_solutions'],
      ['contact_lenses', 'contact_lens_accessories'],
    ],
  },
  {
    key: 'contact_lens_services', unitKey: 'optometry_cabinet', fallbackUnitKeys: ['ophthalmology_office'], capabilityKey: 'contact_lens_professional_services',
    area: 'professional_services', kind: 'professional_service', title: 'Adaptare și monitorizare lentile de contact',
    publicNeedKey: 'contact_lens_services', publicLabel: 'Adaptare lentile de contact',
    description: 'Consultație, probă, instruire, adaptare și control ulterior realizate de un specialist compatibil.',
    note: 'Vânzarea lentilelor de contact nu activează automat serviciile profesionale de adaptare.',
    searchTerms: ['adaptare lentile contact', 'proba lentile', 'invatat lentile', 'lentile speciale', 'ortokeratologie'],
    items: [
      ['contact_lenses', 'contact_lens_consultation'], ['contact_lenses', 'contact_lens_fitting'],
      ['contact_lenses', 'contact_lens_trial'], ['contact_lenses', 'contact_lens_followup'],
      ['contact_lenses', 'contact_lens_insertion_training'], ['contact_lenses', 'specialty_contact_lens_fitting'],
      ['contact_lenses', 'orthokeratology'], ['contact_lenses', 'myopia_control_contact_lenses'],
    ],
  },
  {
    key: 'workshop_adjustments', unitKey: 'optical_workshop', capabilityKey: null,
    area: 'technical_services', kind: 'technical_service', title: 'Reglaje, ajustări și îndreptări',
    publicNeedKey: 'repairs_adjustments', publicLabel: 'Reglaje și ajustări ochelari',
    description: 'Operațiuni uzuale pentru potrivirea, alinierea și confortul ochelarilor.',
    searchTerms: ['reglat ochelari', 'indreptat rame', 'ajustat brate', 'strans suruburi', 'schimb pernute'],
    items: [
      ['technical_activities', 'eyeglasses_adjustment'], ['technical_activities', 'frame_straightening'],
      ['technical_activities', 'temple_adjustment'], ['technical_activities', 'bridge_adjustment'],
      ['technical_activities', 'hinge_adjustment'], ['technical_activities', 'screw_replacement'],
      ['technical_activities', 'nose_pad_replacement'], ['technical_activities', 'temple_tip_replacement'],
    ],
  },
  {
    key: 'workshop_repairs', unitKey: 'optical_workshop', capabilityKey: null,
    area: 'technical_services', kind: 'technical_service', title: 'Reparații rame și componente',
    publicNeedKey: 'repairs_adjustments', publicLabel: 'Reparații ochelari',
    description: 'Reparații ale ramei, balamalelor și componentelor, în limitele dotării atelierului.',
    searchTerms: ['reparat ochelari', 'lipit ochelari', 'sudat rame', 'schimb brat', 'reparat balama'],
    items: [
      ['technical_activities', 'eyeglasses_repair'], ['technical_activities', 'frame_repair'],
      ['technical_activities', 'temple_replacement'], ['technical_activities', 'hinge_repair'],
      ['technical_activities', 'acetate_frame_repair'], ['technical_activities', 'metal_frame_soldering'],
      ['technical_activities', 'frame_polishing'],
    ],
  },
  {
    key: 'workshop_lens_services', unitKey: 'optical_workshop', fallbackUnitKeys: ['optical_laboratory'], capabilityKey: null,
    area: 'technical_services', kind: 'technical_service', title: 'Montaj și înlocuire lentile',
    publicNeedKey: 'lens_mounting', publicLabel: 'Montaj și înlocuire lentile',
    description: 'Montaj, înlocuire, găurire, șanțuire și verificarea finală a lentilelor.',
    searchTerms: ['montaj lentile', 'schimb lentile', 'lentile in rama clientului', 'gaurire rame', 'santuire'],
    items: [
      ['technical_activities', 'lens_fitting'], ['technical_activities', 'lens_replacement'],
      ['technical_activities', 'client_frame_lens_mounting'], ['technical_activities', 'rimless_drilling'],
      ['technical_activities', 'semi_rimless_grooving'], ['technical_activities', 'optical_quality_check'],
      ['technical_activities', 'workshop_orders'],
    ],
  },
  {
    key: 'workshop_maintenance', unitKey: 'optical_workshop', capabilityKey: null,
    area: 'technical_services', kind: 'technical_service', title: 'Curățare și întreținere',
    publicNeedKey: 'repairs_adjustments', publicLabel: 'Întreținere ochelari',
    description: 'Curățare profesională și întreținerea periodică a ramei.',
    searchTerms: ['curatare ochelari', 'ultrasunete ochelari', 'intretinere rame'],
    items: [
      ['technical_activities', 'frame_cleaning'], ['technical_activities', 'ultrasonic_cleaning'],
    ],
  },
  {
    key: 'ophthalmology_consults', unitKey: 'ophthalmology_office', capabilityKey: null,
    area: 'medical_services', kind: 'medical_service', title: 'Consultații și controale oftalmologice',
    publicNeedKey: 'ophthalmology_consults', publicLabel: 'Consultații oftalmologice',
    description: 'Consultații, controale și examinări efectuate de medicul oftalmolog.',
    note: 'Serviciile medicale sunt publicate numai după verificarea medicului și a condițiilor necesare.',
    searchTerms: ['oftalmolog', 'doctor de ochi', 'medic de ochi', 'consult ochi', 'control oftalmologic'],
    items: [
      ['ophthalmology_consults', 'ophthalmology_consultation'], ['ophthalmology_consults', 'complete_eye_exam'],
      ['ophthalmology_consults', 'prescription_check'], ['ophthalmology_consults', 'eye_pressure_check'],
      ['ophthalmology_consults', 'fundus_exam'], ['ophthalmology_consults', 'anterior_segment_exam'],
      ['ophthalmology_consults', 'followup_consultation'], ['ophthalmology_consults', 'second_opinion'],
    ],
  },
  {
    key: 'ophthalmology_investigations', unitKey: 'ophthalmology_diagnostics', capabilityKey: null,
    area: 'medical_services', kind: 'investigation', title: 'Investigații și imagistică',
    publicNeedKey: 'ophthalmology_investigations', publicLabel: 'Investigații oftalmologice',
    description: 'Investigații disponibile în funcție de aparatura verificată a locației.',
    searchTerms: ['oct ochi', 'camp vizual', 'fund de ochi', 'poza retina', 'tensiune oculara', 'topografie corneana', 'ecografie ochi'],
    items: [
      ['investigations', 'oct'], ['investigations', 'visual_field_analyzer'], ['investigations', 'fundus_camera'],
      ['investigations', 'pachymeter'], ['investigations', 'biometer'], ['investigations', 'corneal_topography'],
      ['investigations', 'keratometry'], ['investigations', 'tonometry'], ['investigations', 'gonioscopy'],
      ['investigations', 'ultrasound'], ['investigations', 'specular_microscopy'], ['investigations', 'angiography'],
      ['investigations', 'electroretinography'], ['investigations', 'visual_evoked_potentials'],
    ],
  },
  {
    key: 'retina_macula', unitKey: 'ophthalmology_office', capabilityKey: 'ophthalmology_specialties',
    area: 'medical_specialties', kind: 'specialty', title: 'Retină, vitros și maculă',
    publicNeedKey: 'retina_macula', publicLabel: 'Retină și maculă',
    description: 'Evaluarea și monitorizarea afecțiunilor retiniene, vitreene și maculare.',
    searchTerms: ['retina', 'macula', 'retinopatie diabetica', 'degenerescenta maculara', 'vitros'],
    items: [
      ['specialties', 'retina_consultation'], ['specialties', 'vitreoretinal_consultation'],
      ['specialties', 'diabetic_retinopathy'], ['specialties', 'macular_degeneration'],
    ],
  },
  {
    key: 'glaucoma', unitKey: 'ophthalmology_office', capabilityKey: 'ophthalmology_specialties',
    area: 'medical_specialties', kind: 'specialty', title: 'Glaucom',
    publicNeedKey: 'glaucoma', publicLabel: 'Glaucom',
    description: 'Consultație și monitorizare specializată pentru glaucom.',
    searchTerms: ['glaucom', 'presiune oculara', 'tensiune ochi'],
    items: [['specialties', 'glaucoma_consultation']],
  },
  {
    key: 'cataract_refractive', unitKey: 'ophthalmology_office', capabilityKey: 'ophthalmology_specialties',
    area: 'medical_specialties', kind: 'specialty', title: 'Cataractă și corecție refractivă',
    publicNeedKey: 'cataract', publicLabel: 'Cataractă și chirurgie refractivă',
    description: 'Evaluare specializată pentru cataractă și opțiuni de corecție refractivă.',
    searchTerms: ['cataracta', 'operatie cataracta', 'laser dioptrii', 'chirurgie refractiva'],
    items: [['specialties', 'cataract_consultation']],
  },
  {
    key: 'cornea_surface', unitKey: 'ophthalmology_office', capabilityKey: 'ophthalmology_specialties',
    area: 'medical_specialties', kind: 'specialty', title: 'Cornee și suprafață oculară',
    publicNeedKey: 'cornea_dry_eye', publicLabel: 'Cornee și ochi uscat',
    description: 'Cornee, ochi uscat și managementul miopiei.',
    searchTerms: ['cornee', 'ochi uscat', 'usturime ochi', 'miopie'],
    items: [
      ['specialties', 'cornea_consultation'], ['specialties', 'dry_eye_management'], ['specialties', 'myopia_management'],
    ],
  },
  {
    key: 'pediatric_strabismus', unitKey: 'ophthalmology_office', fallbackUnitKeys: ['optometry_cabinet'], capabilityKey: 'pediatric_eye_care',
    area: 'medical_specialties', kind: 'pediatric_service', title: 'Oftalmologie pediatrică, strabism și ambliopie',
    publicNeedKey: 'pediatric_eye_care', publicLabel: 'Oftalmologie și vedere pentru copii',
    description: 'Consultații, screening, refracție și monitorizare pentru copii.',
    searchTerms: ['control ochi copil', 'oftalmolog copii', 'ochi lenes', 'ambliopie', 'strabism copil', 'miopie copii'],
    items: [
      ['specialties', 'pediatric_ophthalmology'], ['specialties', 'strabismus'],
      ['children_and_prevention', 'children_eye_exam'], ['children_and_prevention', 'pediatric_refraction'],
      ['children_and_prevention', 'amblyopia_screening'], ['children_and_prevention', 'strabismus_screening'],
      ['children_and_prevention', 'school_screening'], ['children_and_prevention', 'myopia_control_children'],
      ['children_and_prevention', 'vision_therapy'],
    ],
  },
  {
    key: 'neuro_inflammation', unitKey: 'ophthalmology_office', capabilityKey: 'ophthalmology_specialties',
    area: 'medical_specialties', kind: 'specialty', title: 'Neuro-oftalmologie și inflamații',
    publicNeedKey: 'neuro_inflammation', publicLabel: 'Neuro-oftalmologie și uveită',
    description: 'Evaluare pentru afecțiuni neuro-oftalmologice și inflamatorii.',
    searchTerms: ['neuro oftalmologie', 'uveita', 'inflamatie oculara', 'nerv optic'],
    items: [['specialties', 'neuro_ophthalmology'], ['specialties', 'uveitis']],
  },
  {
    key: 'oculoplastics_lacrimal', unitKey: 'ophthalmology_office', capabilityKey: 'ophthalmology_specialties',
    area: 'medical_specialties', kind: 'specialty', title: 'Oculoplastică, pleoape și căi lacrimale',
    publicNeedKey: 'oculoplastics_lacrimal', publicLabel: 'Pleoape și căi lacrimale',
    description: 'Evaluarea afecțiunilor pleoapelor, orbitei și sistemului lacrimal.',
    searchTerms: ['pleoape', 'canal lacrimal', 'lacrimare', 'oculoplastica', 'orbij'],
    items: [['specialties', 'oculoplastics_consultation'], ['specialties', 'lacrimal_system_consultation']],
  },
  {
    key: 'emergency_trauma', unitKey: 'ophthalmology_office', fallbackUnitKeys: ['ophthalmology_procedure_room', 'ophthalmology_surgery_unit'], capabilityKey: 'emergency_ophthalmology',
    area: 'medical_specialties', kind: 'emergency_service', title: 'Urgențe și traumatisme oculare',
    publicNeedKey: 'emergency_ophthalmology', publicLabel: 'Urgențe oftalmologice',
    description: 'Evaluarea urgențelor și traumatismelor în limitele capacității verificate a locației.',
    searchTerms: ['urgenta ochi', 'traumatism ochi', 'corp strain ochi', 'durere oculara brusca'],
    items: [['specialties', 'emergency_ophthalmology'], ['specialties', 'ocular_trauma']],
  },
  {
    key: 'low_vision', unitKey: 'optometry_cabinet', fallbackUnitKeys: ['ophthalmology_office'], capabilityKey: 'low_vision_rehabilitation',
    area: 'medical_specialties', kind: 'rehabilitation_service', title: 'Vedere slabă și reabilitare vizuală',
    publicNeedKey: 'low_vision', publicLabel: 'Vedere slabă și reabilitare',
    description: 'Evaluare funcțională și recomandări pentru persoanele cu vedere slabă.',
    searchTerms: ['vedere slaba', 'low vision', 'reabilitare vizuala', 'ajutoare vedere'],
    items: [['specialties', 'low_vision_rehabilitation']],
  },
  {
    key: 'ocular_oncology', unitKey: 'ophthalmology_office', capabilityKey: 'ophthalmology_specialties',
    area: 'medical_specialties', kind: 'specialty', title: 'Oncologie oculară',
    publicNeedKey: 'ocular_oncology', publicLabel: 'Oncologie oculară',
    description: 'Evaluare specializată pentru tumori oculare și ale anexelor.',
    searchTerms: ['oncologie oculara', 'tumora ochi', 'tumora pleoapa'],
    items: [['specialties', 'ocular_oncology']],
  },
  {
    key: 'procedure_room', unitKey: 'ophthalmology_procedure_room', capabilityKey: null,
    area: 'medical_procedures', kind: 'procedure', title: 'Proceduri, injecții și laser',
    publicNeedKey: 'procedures_treatments', publicLabel: 'Proceduri și tratamente oftalmologice',
    description: 'Proceduri realizate într-o sală compatibilă, cu medic, aparatură și infrastructură verificate.',
    searchTerms: ['laser ochi', 'injectie ochi', 'yag', 'laser retina', 'chalazion', 'corp strain'],
    items: [
      ['procedures_surgery', 'laser_procedures'], ['procedures_surgery', 'yag_laser'],
      ['procedures_surgery', 'retinal_laser'], ['procedures_surgery', 'intravitreal_injections'],
      ['procedures_surgery', 'chalazion_treatment'], ['procedures_surgery', 'minor_eye_procedures'],
      ['procedures_surgery', 'corneal_crosslinking'], ['procedures_surgery', 'foreign_body_removal'],
      ['procedures_surgery', 'lacrimal_procedures'], ['procedures_surgery', 'oculoplastic_procedures'],
    ],
  },
  {
    key: 'surgery', unitKey: 'ophthalmology_surgery_unit', capabilityKey: null,
    area: 'medical_procedures', kind: 'surgery', title: 'Chirurgie oftalmologică',
    publicNeedKey: 'ophthalmology_surgery', publicLabel: 'Chirurgie oftalmologică',
    description: 'Intervenții chirurgicale efectuate într-o unitate și cu echipamente verificate.',
    searchTerms: ['operatie ochi', 'chirurgie cataracta', 'chirurgie retina', 'vitrectomie', 'chirurgie pleoape'],
    items: [
      ['procedures_surgery', 'cataract_surgery'], ['procedures_surgery', 'refractive_surgery'],
      ['procedures_surgery', 'eyelid_surgery'], ['procedures_surgery', 'vitreoretinal_surgery'],
    ],
  },
  {
    key: 'b2b_products', unitKey: 'b2b_distribution_center', fallbackUnitKeys: ['optical_laboratory'], capabilityKey: 'b2b_distribution',
    area: 'b2b', kind: 'b2b_product', title: 'Portofoliu și distribuție B2B',
    publicNeedKey: null, publicLabel: '',
    description: 'Categorii de produse și soluții furnizate partenerilor profesionali.',
    searchTerms: ['distributie b2b', 'rame en gros', 'lentile en gros', 'furnizor optica'],
    items: [
      ['b2b_capabilities', 'wholesale_frames'], ['b2b_capabilities', 'wholesale_ophthalmic_lenses'],
      ['b2b_capabilities', 'wholesale_contact_lenses'], ['b2b_capabilities', 'ophthalmic_equipment_distribution'],
      ['b2b_capabilities', 'consumables_distribution'],
    ],
  },
  {
    key: 'b2b_processing', unitKey: 'optical_laboratory', capabilityKey: 'b2b_distribution',
    area: 'b2b', kind: 'b2b_service', title: 'Prelucrare și montaj pentru parteneri',
    publicNeedKey: null, publicLabel: '',
    description: 'Capabilități tehnice oferite opticilor și altor parteneri profesionali.',
    searchTerms: ['prelucrare lentile b2b', 'montaj b2b', 'laborator partener'],
    items: [
      ['b2b_capabilities', 'b2b_lens_processing'], ['b2b_capabilities', 'b2b_frame_lens_mounting'],
      ['b2b_capabilities', 'b2b_private_label'],
    ],
  },
  {
    key: 'b2b_logistics_support', unitKey: 'b2b_distribution_center', fallbackUnitKeys: ['optical_laboratory'], capabilityKey: 'b2b_logistics',
    area: 'b2b', kind: 'b2b_service', title: 'Logistică și suport B2B',
    publicNeedKey: null, publicLabel: '',
    description: 'Livrare, suport tehnic, instruire și servicii comerciale pentru parteneri.',
    searchTerms: ['livrare b2b', 'suport tehnic', 'training optica', 'logistica'],
    items: [
      ['b2b_capabilities', 'b2b_logistics_delivery'], ['b2b_capabilities', 'b2b_technical_support'],
    ],
  },
].map((section) => ({
  ...section,
  items: section.items.map(([group, id]) => ({ group, id })),
}));

export const PUBLIC_NEED_SECTIONS = [
  ['glasses_frames', 'Ochelari și rame'],
  ['ophthalmic_lenses', 'Lentile pentru ochelari'],
  ['sun_protection', 'Ochelari de soare și protecție'],
  ['contact_lens_products', 'Lentile de contact'],
  ['eye_exam', 'Control vedere și dioptrii'],
  ['optical_measurements', 'Măsurători și centrare'],
  ['contact_lens_services', 'Adaptare lentile de contact'],
  ['repairs_adjustments', 'Reparații și ajustări ochelari'],
  ['lens_mounting', 'Montaj și înlocuire lentile'],
  ['ophthalmology_consults', 'Consultații oftalmologice'],
  ['ophthalmology_investigations', 'Investigații oftalmologice'],
  ['pediatric_eye_care', 'Oftalmologie și vedere pentru copii'],
  ['glaucoma', 'Glaucom'],
  ['cataract', 'Cataractă și chirurgie refractivă'],
  ['retina_macula', 'Retină și maculă'],
  ['cornea_dry_eye', 'Cornee și ochi uscat'],
  ['neuro_inflammation', 'Neuro-oftalmologie și uveită'],
  ['oculoplastics_lacrimal', 'Pleoape și căi lacrimale'],
  ['emergency_ophthalmology', 'Urgențe oftalmologice'],
  ['low_vision', 'Vedere slabă și reabilitare'],
  ['ocular_oncology', 'Oncologie oculară'],
  ['procedures_treatments', 'Proceduri și tratamente'],
  ['ophthalmology_surgery', 'Chirurgie oftalmologică'],
].map(([key, label]) => ({ key, label }));

export const CURATED_SERVICE_SEARCH_SYNONYMS = {
  eyeglasses: ['ochelari vedere', 'ochelari cu dioptrii'],
  frames: ['rame vedere', 'rame ochelari'],
  prescription_lenses: ['lentile ochelari', 'sticle ochelari'],
  refraction: ['masurat dioptrii', 'determinare dioptrii'],
  optometry_consultation: ['control vedere', 'consult optometrist'],
  ophthalmology_consultation: ['doctor de ochi', 'medic de ochi', 'oftalmolog'],
  fundus_exam: ['fund de ochi', 'examinare retina'],
  fundus_camera: ['poza retina', 'fotografie retina'],
  visual_field_analyzer: ['camp vizual', 'perimetrie'],
  tonometry: ['tensiune oculara', 'presiune ochi'],
  oct: ['tomografie ochi', 'oct retina'],
  eyeglasses_adjustment: ['reglaj rame', 'ajustare ochelari'],
  frame_straightening: ['indreptat rame', 'indreptare ochelari'],
  screw_replacement: ['schimb surub', 'strans suruburi'],
  nose_pad_replacement: ['schimb pernute', 'pernite nazale'],
  metal_frame_soldering: ['sudat rame', 'lipit rame metalice'],
  acetate_frame_repair: ['lipit rama plastic', 'reparat acetat'],
  lens_replacement: ['schimb lentile', 'inlocuit sticle'],
  client_frame_lens_mounting: ['lentile in rama clientului', 'montaj rama proprie'],
  pediatric_ophthalmology: ['oftalmolog copii', 'control ochi copil'],
  amblyopia_screening: ['ochi lenes', 'ambliopie copil'],
  strabismus: ['ochi incrucisati', 'strabism'],
  emergency_ophthalmology: ['urgenta ochi', 'durere oculara brusca'],
  ocular_trauma: ['lovitura ochi', 'traumatism ocular'],
  low_vision_rehabilitation: ['vedere slaba', 'low vision'],
};

export const SERVICE_OPERATIONAL_CONTEXT = Object.fromEntries(
  PROVIDER_SERVICE_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, {
    serviceKey: item.id,
    group: item.group,
    sectionKey: section.key,
    unitKey: section.unitKey,
    fallbackUnitKeys: [...(section.fallbackUnitKeys || [])],
    capabilityKey: section.capabilityKey || null,
    publicNeedKey: section.publicNeedKey || null,
    kind: section.kind,
  }])),
);

export function getServiceOperationalContext(serviceKey) {
  const context = SERVICE_OPERATIONAL_CONTEXT[String(serviceKey || '').trim()];
  return context ? { ...context, fallbackUnitKeys: [...context.fallbackUnitKeys] } : null;
}

export function getProviderServiceSections() {
  return PROVIDER_SERVICE_SECTIONS.map((section) => ({
    ...section,
    searchTerms: [...(section.searchTerms || [])],
    fallbackUnitKeys: [...(section.fallbackUnitKeys || [])],
    items: section.items.map((item) => ({ ...item })),
  }));
}

export function getPublicNeedSections() {
  return PUBLIC_NEED_SECTIONS.map((section) => ({ ...section }));
}

export function getServiceSearchTerms(serviceKey) {
  const definition = getCanonicalServiceDefinition(serviceKey);
  const context = getServiceOperationalContext(serviceKey);
  const section = PROVIDER_SERVICE_SECTIONS.find((item) => item.key === context?.sectionKey);
  return [...new Set([
    definition?.label,
    ...(definition?.aliases || []),
    ...(section?.searchTerms || []),
    ...(CURATED_SERVICE_SEARCH_SYNONYMS[serviceKey] || []),
  ].filter(Boolean))];
}

export function validateOperationalTaxonomy() {
  const flattened = PROVIDER_SERVICE_SECTIONS.flatMap((section) => section.items.map((item) => item.id));
  const duplicates = flattened.filter((key, index) => flattened.indexOf(key) !== index);
  const canonical = new Set(CANONICAL_SERVICE_KEYS);
  const unknown = flattened.filter((key) => !canonical.has(key));
  const missing = CANONICAL_SERVICE_KEYS.filter((key) => !flattened.includes(key));
  return {
    valid: duplicates.length === 0 && unknown.length === 0 && missing.length === 0,
    duplicates: [...new Set(duplicates)],
    unknown: [...new Set(unknown)],
    missing,
    total: flattened.length,
  };
}
