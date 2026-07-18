import React from "react";
import LegalPageLayout, {
  LegalList,
  LegalNote,
} from "@/components/legal/LegalPageLayout";
import { openCookieSettings } from "@/lib/cookieConsent";
import { VIASEE_COMPANY } from "@/lib/legal";

export default function Cookies() {
  const sections = [
    {
      id: "ce-sunt",
      title: "Ce sunt cookie-urile",
      content: (
        <p>
          Cookie-urile și tehnologiile similare sunt informații stocate sau
          citite pe dispozitiv pentru a permite funcționarea unui site, a reține
          preferințe ori a măsura utilizarea. Unele funcții folosesc și stocarea
          locală a browserului.
        </p>
      ),
    },
    {
      id: "categorii",
      title: "Categoriile folosite de VIASEE",
      content: (
        <>
          <LegalList>
            <li>
              <strong>Necesare:</strong> autentificare, securitate, funcțiile
              cerute și salvarea preferințelor. Sunt mereu active.
            </li>
            <li>
              <strong>Analiză:</strong> măsurarea agregată a utilizării, numai
              după acord.
            </li>
            <li>
              <strong>Marketing:</strong> măsurarea campaniilor și publicitate,
              numai după acord.
            </li>
          </LegalList>
          <LegalNote>
            Înregistrarea sesiunilor nu este activată și nu este inclusă în
            preferințele VIASEE.
          </LegalNote>
        </>
      ),
    },
    {
      id: "necesare",
      title: "Elemente strict necesare",
      content: (
        <>
          <p>
            Base44 și componentele tehnice ale aplicației pot folosi
            identificatori necesari autentificării, protejării sesiunii,
            prevenirii abuzurilor și furnizării funcțiilor solicitate.
          </p>
          <p>
            VIASEE salvează local alegerea privind cookies sub cheia{" "}
            <code className="bg-[#ebe4d9] px-1.5 py-0.5 text-sm text-[#171717]">
              viasee_cookie_consent_v1
            </code>
            {", împreună cu versiunea și data actualizării."}
          </p>
        </>
      ),
    },
    {
      id: "analytics",
      title: "Google Analytics",
      content: (
        <>
          <p>
            VIASEE folosește Google Analytics 4, cu identificatorul de măsurare{" "}
            <code className="bg-[#ebe4d9] px-1.5 py-0.5 text-sm text-[#171717]">
              G-YWTE0T07CH
            </code>
            {". Eticheta Google este încărcată numai după acordul pentru categoria „Analiză”. Dacă acordul este retras, măsurarea este dezactivată și cookie-urile Analytics accesibile site-ului sunt șterse."}
          </p>
          <p>
            Sunt măsurate vizualizările paginilor, interacțiunile automate
            activate în măsurarea îmbunătățită, precum scrollurile și clickurile
            către domenii externe, precum și informații tehnice despre browser,
            dispozitiv și localizarea aproximativă. Nu trebuie introduse în
            Analytics nume, adrese de e-mail, numere de telefon sau alte date
            care identifică direct o persoană.
          </p>
          <LegalList>
            <li>
              <code>_ga</code>: diferențiază utilizatorii; durata prestabilită
              este de 2 ani.
            </li>
            <li>
              <code>_ga_&lt;container-id&gt;</code>: păstrează starea sesiunii;
              durata prestabilită este de 2 ani.
            </li>
          </LegalList>
          <LegalNote>
            Browserul sau setările utilizatorului pot limita ori scurta durata
            efectivă a acestor cookie-uri.
          </LegalNote>
        </>
      ),
    },
    {
      id: "meta",
      title: "Meta Pixel",
      content: (
        <>
          <p>
            Meta Pixel nu este activ în versiunea curentă a codului public
            VIASEE. Dacă va fi activat, scriptul și evenimentele de marketing vor
            porni numai după acordul pentru categoria „Marketing”.
          </p>
          <p>
            Refuzul marketingului nu împiedică folosirea funcțiilor principale
            ale platformei.
          </p>
        </>
      ),
    },
    {
      id: "stripe",
      title: "Stripe și plata",
      content: (
        <p>
          Când deschizi fluxul de plată, Stripe poate folosi tehnologii necesare
          securității, prevenirii fraudei și procesării plății. Acestea sunt
          descrise și în documentele Stripe afișate în mediul de plată.
        </p>
      ),
    },
    {
      id: "alegere",
      title: "Cum îți schimbi alegerea",
      content: (
        <>
          <p>
            Poți accepta toate categoriile, refuza opționalele sau alege separat
            analiza și marketingul. Retragerea acordului nu afectează legalitatea
            utilizării realizate înainte de retragere.
          </p>
          <button
            type="button"
            onClick={openCookieSettings}
            className="mt-3 min-h-11 rounded-full bg-[#171717] px-6 text-sm font-semibold text-white"
          >
            Deschide setările cookies
          </button>
        </>
      ),
    },
    {
      id: "browser-contact",
      title: "Browser și contact",
      content: (
        <>
          <p>
            Poți șterge cookie-urile și datele locale și din setările
            browserului. Blocarea elementelor strict necesare poate împiedica
            autentificarea sau funcționarea anumitor pagini.
          </p>
          <p>
            Pentru întrebări, scrie-ne la{" "}
            <a
              className="font-semibold text-[#171717] underline underline-offset-4"
              href={`mailto:${VIASEE_COMPANY.contactEmail}`}
            >
              {VIASEE_COMPANY.contactEmail}
            </a>
            .
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPageLayout
      eyebrow="CONTROLUL PREFERINȚELOR"
      title="Politica de cookies"
      intro="Folosim numai elementele necesare în mod implicit. Analiza și marketingul rămân la alegerea ta."
      sections={sections}
    />
  );
}
