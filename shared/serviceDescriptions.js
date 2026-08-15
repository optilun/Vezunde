// Descrieri scurte pentru serviciile din catalog (2026-08-06).
//
// De ce exista acest fisier: in interfata de configurare, un rand care contine
// doar "Ochelari de vedere" nu spune furnizorului nimic despre ce declara.
// Descrierea de o propozitie transforma lista de bifat intr-un ecran de setari
// care se explica singur - modelul cerut de Alex (referinta: Setarile Claude).
//
// REGULI DE REDACTARE:
// - o singura propozitie, la persoana a doua ("Vinzi...", "Masori...")
// - descrie CE OFERA furnizorul, nu definitia medicala a termenului
// - fara promisiuni de rezultat medical si fara indicatii terapeutice
// - serviciile medicale (investigations, procedures_surgery, specialties)
//   necesita validare de la cineva cu pregatire medicala INAINTE de publicare
//
// Acoperire curenta: cele 21 de servicii configurate pe Lunera Optic Store,
// primul cont real. Restul se completeaza pe grupuri, la nevoie. Un serviciu
// fara descriere se randeaza normal, doar cu eticheta - absenta nu strica nimic.

export const SERVICE_DESCRIPTIONS = {
  // optical_retail
  eyeglasses: 'Vinzi ochelari de vedere completi, cu rama si lentile montate.',
  frames: 'Ai rame in stoc, din care clientul poate alege in magazin.',
  prescription_lenses: 'Comanzi si montezi lentile dupa reteta clientului.',
  sunglasses: 'Vinzi ochelari de soare fara dioptrii.',
  prescription_sunglasses: 'Vinzi ochelari de soare cu lentile pe dioptrii.',
  sports_glasses: 'Ai ochelari pentru activitati sportive sau conditii speciale.',

  // lenses_and_measurements
  progressive_lenses: 'Comanzi lentile progresive, pentru vedere la toate distantele.',
  prism_lenses: 'Comanzi lentile cu prisma, pe baza indicatiei din reteta.',
  pd_measurement: 'Masori distanta dintre pupile, necesara pentru montaj corect.',
  reading_lenses: 'Comanzi lentile pentru citit si lucru la distanta mica.',
  thin_lenses: 'Oferi variante subtiate pentru dioptrii mari.',
  office_lenses: 'Comanzi lentile pentru birou si lucru la calculator.',

  // optometry
  visual_acuity_test: 'Verifici cat de bine vede clientul, la distanta si aproape.',
  refraction: 'Stabilesti dioptriile necesare si eliberezi valorile pentru ochelari.',
  occupational_vision: 'Evaluezi vederea pentru cerintele unui anumit loc de munca.',

  // contact_lenses
  contact_lens_consultation: 'Verifici daca lentilele de contact sunt potrivite si stabilesti parametrii.',
  multifocal_contact_lenses: 'Adaptezi lentile de contact pentru vedere la mai multe distante.',
  rgp_lenses: 'Adaptezi lentile rigide gaz-permeabile, pentru cazuri care nu se rezolva cu lentile moi.',

  // technical_activities
  eyeglasses_adjustment: 'Ajustezi ochelarii pe fata clientului, pentru pozitie si confort.',
  eyeglasses_repair: 'Repari ochelari deteriorati, in limitele dotarii atelierului.',
  frame_repair: 'Repari sau inlocuiesti componente ale ramei.',
};

export function getServiceDescription(serviceKey) {
  return SERVICE_DESCRIPTIONS[serviceKey] || '';
}
