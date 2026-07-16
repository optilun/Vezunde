import React from "react";
import LegalPageLayout, { LegalList, LegalNote } from "@/components/legal/LegalPageLayout";
import { VIASEE_COMPANY } from "@/lib/legal";

export default function PaymentsAndSubscriptions() {
  const sections = [
    {
      id: "aplicabilitate",
      title: "Cui se aplică",
      content: (
        <p>Aceste condiții se aplică abonamentelor VIASEE achiziționate pentru un profil profesional, o optică, un cabinet, o clinică sau o altă organizație eligibilă. Facturarea poate fi realizată către o persoană fizică sau juridică.</p>
      ),
    },
    {
      id: "scop-profesional",
      title: "Utilizare profesională",
      content: (
        <>
          <p>Abonamentul este destinat utilizării în legătură cu activitatea profesională. Persoana care îl activează confirmă că are dreptul să administreze profilul și să angajeze titularul datelor de facturare.</p>
          <p>Dacă, într-un caz concret, cumpărătorul beneficiază de drepturi obligatorii în calitate de consumator, acele drepturi rămân aplicabile.</p>
        </>
      ),
    },
    {
      id: "planuri-facturare",
      title: "Planuri lunare și anuale",
      content: (
        <>
          <p>Planul, perioada, moneda, taxele aplicabile și totalul sunt afișate înainte de confirmarea plății. Abonamentele pot avea facturare lunară sau anuală.</p>
          <p>Cu excepția cazului în care oferta precizează altfel, abonamentul se reînnoiește automat pentru aceeași perioadă până când este anulat.</p>
        </>
      ),
    },
    {
      id: "stripe",
      title: "Procesarea prin Stripe",
      content: (
        <>
          <p>Plata este procesată prin Stripe. Prin confirmare autorizezi debitarea metodei de plată pentru suma și perioada afișate.</p>
          <p>VIASEE nu stochează numărul complet al cardului sau codul de securitate. Putem păstra identificatori Stripe, starea abonamentului, perioada, facturile și evenimentele necesare suportului și reconcilierii.</p>
        </>
      ),
    },
    {
      id: "date-facturare",
      title: "Date și documente de facturare",
      content: (
        <>
          <p>Clientul trebuie să furnizeze date corecte și actuale: nume sau denumire, adresă de facturare, CUI/cod fiscal unde este cazul și celelalte informații cerute.</p>
          <p>Documentele aferente plății sunt emise conform datelor completate și regulilor fiscale aplicabile. O confirmare Stripe nu înlocuiește automat toate documentele fiscale cerute de legislația română.</p>
        </>
      ),
    },
    {
      id: "anulare",
      title: "Anularea abonamentului",
      content: (
        <>
          <LegalNote>Poți anula abonamentul oricând. După anulare, acesta rămâne activ până la sfârșitul lunii sau anului deja plătit și nu se mai reînnoiește.</LegalNote>
          <p>Anularea nu șterge automat profilul sau contul. La finalul perioadei plătite, funcțiile incluse în abonament încetează ori contul revine la nivelul disponibil fără abonament.</p>
        </>
      ),
    },
    {
      id: "rambursari",
      title: "Rambursări",
      content: (
        <>
          <p>Perioadele deja începute nu se rambursează proporțional doar pentru că abonamentul este anulat înainte de data expirării.</p>
          <p>Putem analiza rambursări pentru plăți duplicate, erori de facturare, indisponibilitate semnificativă imputabilă VIASEE sau alte situații cerute de lege. Solicitarea trebuie să includă contul, plata și motivul.</p>
        </>
      ),
    },
    {
      id: "retragere",
      title: "Dreptul legal de retragere",
      content: (
        <p>Dacă un cumpărător este, potrivit legii, consumator și beneficiază de drept de retragere, VIASEE va respecta perioada și condițiile obligatorii. Pentru începerea imediată a serviciului poate fi solicitat acordul expres și confirmarea consecințelor prevăzute de lege.</p>
      ),
    },
    {
      id: "schimbare-plan",
      title: "Schimbarea planului",
      content: (
        <LegalList>
          <li>Un upgrade poate intra în vigoare imediat, cu diferența afișată înainte de confirmare.</li>
          <li>Un downgrade poate intra în vigoare la următoarea reînnoire.</li>
          <li>Funcțiile, limitele și prețurile curente sunt cele afișate în pagina planului sau în cont.</li>
        </LegalList>
      ),
    },
    {
      id: "plata-esuata",
      title: "Plată eșuată și suspendare",
      content: (
        <p>Dacă plata nu poate fi procesată, putem reîncerca debitarea, solicita actualizarea metodei de plată și limita funcțiile plătite. Profilul și datele nu sunt șterse imediat doar pentru o plată eșuată.</p>
      ),
    },
    {
      id: "modificari",
      title: "Modificări și notificări",
      content: (
        <p>Pentru modificări importante ale prețului sau condițiilor de reînnoire vom folosi o notificare rezonabilă înainte de următoarea perioadă facturată. Poți anula înainte ca schimbarea să producă efecte.</p>
      ),
    },
    {
      id: "contact",
      title: "Suport pentru plăți",
      content: (
        <p>Pentru anulări, facturi sau plăți, scrie-ne la <a className="font-semibold text-[#171717] underline underline-offset-4" href={`mailto:${VIASEE_COMPANY.contactEmail}`}>{VIASEE_COMPANY.contactEmail}</a> și include emailul contului și identificatorul plății, fără datele complete ale cardului.</p>
      ),
    },
  ];

  return (
    <LegalPageLayout
      eyebrow="PENTRU SPECIALIȘTI"
      title="Plăți și abonamente"
      intro="Cum funcționează facturarea lunară sau anuală, reînnoirea și anularea unui abonament profesional VIASEE."
      sections={sections}
    />
  );
}

