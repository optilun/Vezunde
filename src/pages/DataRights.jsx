import React from "react";
import LegalPageLayout, { LegalList, LegalNote } from "@/components/legal/LegalPageLayout";
import { VIASEE_COMPANY } from "@/lib/legal";

export default function DataRights() {
  const sections = [
    {
      id: "drepturi",
      title: "Ce poți solicita",
      content: (
        <LegalList>
          <li>Confirmarea dacă îți prelucrăm datele și acces la acestea.</li>
          <li>Corectarea informațiilor inexacte sau completarea lor.</li>
          <li>Ștergerea datelor, atunci când condițiile legale sunt îndeplinite.</li>
          <li>Restricționarea prelucrării în anumite situații.</li>
          <li>Portabilitatea datelor furnizate, într-un format utilizabil.</li>
          <li>Opoziția față de prelucrările bazate pe interes legitim.</li>
          <li>Retragerea consimțământului pentru date sensibile, analiză sau marketing.</li>
        </LegalList>
      ),
    },
    {
      id: "solicitare",
      title: "Cum trimiți solicitarea",
      content: (
        <>
          <p>Trimite un email la <a className="font-semibold text-[#171717] underline underline-offset-4" href={`mailto:${VIASEE_COMPANY.contactEmail}?subject=Solicitare privind datele personale`}>{VIASEE_COMPANY.contactEmail}</a> cu subiectul „Solicitare privind datele personale”.</p>
          <LegalList>
            <li>Spune ce drept dorești să exerciți.</li>
            <li>Indică emailul sau telefonul folosit în VIASEE.</li>
            <li>Descrie cererea suficient pentru a identifica datele vizate.</li>
            <li>Nu trimite copie după actul de identitate decât dacă ți-o solicităm justificat.</li>
          </LegalList>
        </>
      ),
    },
    {
      id: "identitate",
      title: "Verificarea identității",
      content: (
        <p>Pentru a proteja datele, putem cere informații suplimentare sau confirmarea prin contul ori adresa folosită inițial. Solicităm numai ce este necesar verificării și nu folosim informația pentru alt scop.</p>
      ),
    },
    {
      id: "termen",
      title: "Când răspundem",
      content: (
        <>
          <p>Răspundem fără întârzieri nejustificate și, de regulă, în cel mult o lună. Pentru cereri complexe sau numeroase, termenul poate fi prelungit conform legii, cu informarea motivelor.</p>
          <p>Exercitarea drepturilor este gratuită. Putem refuza ori solicita o taxă rezonabilă numai în situațiile permise de lege, de exemplu pentru cereri vădit nefondate sau excesive.</p>
        </>
      ),
    },
    {
      id: "limitari",
      title: "Situații în care datele nu pot fi șterse imediat",
      content: (
        <p>Unele informații pot fi păstrate dacă există o obligație legală, un litigiu, necesitatea prevenirii fraudei sau apărarea unui drept. În acest caz explicăm ce date păstrăm, motivul și perioada aplicabilă.</p>
      ),
    },
    {
      id: "consimtamant",
      title: "Retragerea consimțământului",
      content: (
        <>
          <p>Poți retrage separat acordul pentru informații sensibile, localizare precisă, analiză și marketing. Retragerea nu afectează prelucrările realizate legal anterior.</p>
          <LegalNote>Preferințele pentru analiză și marketing pot fi schimbate direct din „Setări cookies”, disponibil în footer.</LegalNote>
        </>
      ),
    },
    {
      id: "plangere",
      title: "Dreptul de a depune o plângere",
      content: (
        <>
          <p>Te încurajăm să ne contactezi mai întâi pentru a putea clarifica situația.</p>
          <p>Ai și dreptul de a depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal, prin informațiile publicate pe <a className="font-semibold text-[#171717] underline underline-offset-4" href="https://www.dataprotection.ro/" target="_blank" rel="noreferrer">dataprotection.ro</a>.</p>
        </>
      ),
    },
    {
      id: "operator",
      title: "Datele operatorului",
      content: (
        <>
          <p><strong>{VIASEE_COMPANY.legalName}</strong></p>
          <p>CUI {VIASEE_COMPANY.taxId} · ONRC {VIASEE_COMPANY.registrationNumber} · {VIASEE_COMPANY.registeredOffice}</p>
          <p>Email: <a className="font-semibold text-[#171717] underline underline-offset-4" href={`mailto:${VIASEE_COMPANY.contactEmail}`}>{VIASEE_COMPANY.contactEmail}</a></p>
        </>
      ),
    },
  ];

  return (
    <LegalPageLayout
      eyebrow="CONTROL ASUPRA DATELOR"
      title="Drepturile tale"
      intro="Poți afla ce date avem, le poți corecta și poți cere ștergerea sau limitarea lor, în condițiile prevăzute de lege."
      sections={sections}
    />
  );
}

