import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getGuide } from "@/data/specialistGuides";

const SITE_URL = "https://viasee.ro";
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const DEFAULT_DESCRIPTION =
  "VIASEE te ajută să găsești medici oftalmologi, optometriști, opticieni, clinici și servicii pentru vedere, investigații, ochelari sau reparații în România.";
const ORGANIZATION_DESCRIPTION =
  "VIASEE este o platformă românească de descoperire, orientare și promovare pentru servicii de vedere, locații și profesioniști din România.";

const STATIC_META = {
  "/": {
    title: "VIASEE — Găsește servicii pentru vedere în România",
    description: DEFAULT_DESCRIPTION,
  },
  "/despre-viasee": {
    title: "Despre VIASEE — platforma pentru servicii de vedere",
    description:
      "Află ce este VIASEE, cum funcționează platforma, ce servicii pentru vedere acoperă și cum sunt verificate informațiile publice.",
    type: "about",
  },
  "/ghid": {
    title: "Ghid pentru vedere și alegerea specialistului | VIASEE",
    description:
      "Informații clare despre optometrist, optician medical, medic oftalmolog și serviciile pentru vedere.",
    type: "article",
  },
  "/ghid/optometrist-optician-oftalmolog": {
    title: "Optometrist, optician sau oftalmolog? | VIASEE",
    description:
      "Compară rolurile optometristului, opticianului medical și medicului oftalmolog și află unde să mergi în funcție de nevoie.",
    type: "article",
  },
  "/cum-verificam-informatiile": {
    title: "Cum verificăm informațiile publicate | VIASEE",
    description:
      "Află cum documentează, revizuiește și actualizează VIASEE informațiile editoriale despre vedere.",
    type: "article",
  },
  "/parteneri": { title: "Parteneri VIASEE", description: DEFAULT_DESCRIPTION },
  "/pentru-specialisti": {
    title: "VIASEE pentru specialiști și locații",
    description:
      "Prezintă serviciile, specializările, echipa și locațiile tale printr-un profil VIASEE.",
  },
  "/confidentialitate": { title: "Confidențialitate | VIASEE" },
  "/termeni": { title: "Termeni și condiții | VIASEE" },
  "/cookies": { title: "Politica de cookies | VIASEE" },
  "/plati-si-abonamente": { title: "Plăți și abonamente | VIASEE" },
  "/drepturile-tale": { title: "Drepturile tale privind datele | VIASEE" },
  "/adauga-sau-revendica": {
    title: "Adaugă sau revendică un profil | VIASEE",
    description:
      "Adaugă sau revendică profilul tău profesional ori profilul unei locații pe VIASEE.",
    noindex: true,
  },
  "/cauta": {
    title: "Caută furnizori | VIASEE",
    description: DEFAULT_DESCRIPTION,
  },
  "/cerere": {
    title: "Cererea ta | VIASEE",
    description: DEFAULT_DESCRIPTION,
  },
  "/rezultate": {
    title: "Rezultatele cererii tale | VIASEE",
    description: DEFAULT_DESCRIPTION,
    noindex: true,
  },
  "/login": { title: "Autentificare | VIASEE" },
  "/register": { title: "Creează cont | VIASEE" },
  "/forgot-password": { title: "Recuperare parolă | VIASEE" },
  "/reset-password": { title: "Resetare parolă | VIASEE" },
  "/accept-professional-invitation": {
    title: "Acceptă invitația profesională | VIASEE",
  },
  "/accept-provider-invitation": {
    title: "Acceptă invitația de furnizor | VIASEE",
  },
  "/profil-profesional/nou": {
    title: "Creează profilul profesional | VIASEE",
  },
  "/contul-meu": { title: "Contul meu | VIASEE" },
  "/dupa-login": { title: "Se încarcă contul | VIASEE" },
  "/ajutor-si-suport": { title: "Ajutor și suport | VIASEE" },
  "/admin/operatiuni": { title: "Administrare VIASEE" },
};

const NOINDEX_PREFIXES = [
  "/admin",
  "/contul-meu",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/dupa-login",
  "/accept-",
  "/profil-profesional/nou",
  "/cerere",
  "/cauta",
  "/ajutor-si-suport",
];

function ensureMeta(selector, attributes) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    document.head.appendChild(node);
  }
  Object.entries(attributes).forEach(([key, value]) =>
    node.setAttribute(key, value),
  );
}

async function getMetadata(pathname) {
  const guideMatch = pathname.match(
    /^\/ghid\/(optician-medical|optometrist|medic-oftalmolog)$/,
  );
  if (guideMatch) {
    const guide = getGuide(guideMatch[1]);
    return {
      title: `${guide.title.replace(/\?$/, "")} | VIASEE`,
      description: guide.description,
      type: "article",
      guide,
    };
  }

  const topicMatch = pathname.match(/^\/ghid\/([^/]+)\/([^/]+)$/);
  if (topicMatch) {
    const { getTopicGuide } = await import("@/data/topicGuides");
    const guide = getTopicGuide(topicMatch[1], topicMatch[2]);
    if (guide) {
      return {
        title: `${guide.title.replace(/\?$/, "")} | VIASEE`,
        description: guide.description,
        type: "article",
        guide,
      };
    }
  }

  if (pathname.startsWith("/furnizor/")) {
    return {
      title: "Profil locație | VIASEE",
      description: DEFAULT_DESCRIPTION,
    };
  }

  if (pathname.startsWith("/specialist/")) {
    return {
      title: "Profil specialist | VIASEE",
      description: DEFAULT_DESCRIPTION,
    };
  }

  if (pathname.startsWith("/organizatie/")) {
    return {
      title: "Profil organizație | VIASEE",
      description: DEFAULT_DESCRIPTION,
    };
  }

  return (
    STATIC_META[pathname] || {
      title: "Pagina nu a fost găsită | VIASEE",
      description: "Pagina solicitată nu este disponibilă.",
      noindex: true,
    }
  );
}

function buildOrganization() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "VIASEE",
    alternateName: ["VIASEE România", "VIASEE servicii pentru vedere"],
    legalName: "Lunera Optic SRL",
    url: SITE_URL,
    email: "contact@viasee.ro",
    description: ORGANIZATION_DESCRIPTION,
    areaServed: {
      "@type": "Country",
      name: "România",
    },
    knowsAbout: [
      "servicii pentru vedere",
      "optică medicală",
      "optometrie",
      "oftalmologie",
      "ochelari și lentile",
      "investigații oftalmologice",
    ],
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "CUI",
        value: "53362575",
      },
      {
        "@type": "PropertyValue",
        propertyID: "ONRC",
        value: "J2026003935004",
      },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "contact@viasee.ro",
      availableLanguage: ["ro"],
    },
  };
}

function buildWebsite() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "VIASEE",
    alternateName: "VIASEE România",
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "ro-RO",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

function buildStructuredData(pathname, metadata, canonical) {
  const organization = buildOrganization();
  const website = buildWebsite();

  if (pathname === "/") {
    return {
      "@context": "https://schema.org",
      "@graph": [organization, website],
    };
  }

  if (pathname === "/despre-viasee") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        organization,
        website,
        {
          "@type": "AboutPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: "Despre VIASEE",
          description: metadata.description,
          inLanguage: "ro-RO",
          isPartOf: { "@id": WEBSITE_ID },
          mainEntity: { "@id": ORGANIZATION_ID },
          about: { "@id": ORGANIZATION_ID },
        },
      ],
    };
  }

  if (metadata.type !== "article") return null;

  const breadcrumbs = [
    { name: "VIASEE", item: `${SITE_URL}/` },
    { name: "Ghid", item: `${SITE_URL}/ghid` },
  ];
  if (pathname !== "/ghid") {
    breadcrumbs.push({
      name: metadata.guide?.name || metadata.title.replace(" | VIASEE", ""),
      item: canonical,
    });
  }

  const graph = [
    organization,
    {
      "@type": "Article",
      headline: metadata.title.replace(" | VIASEE", ""),
      description: metadata.description,
      mainEntityOfPage: canonical,
      isPartOf: { "@id": WEBSITE_ID },
      inLanguage: "ro-RO",
      dateModified: "2026-07-17",
      author: { "@id": ORGANIZATION_ID },
      publisher: { "@id": ORGANIZATION_ID },
      ...(metadata.guide?.sources?.length
        ? { citation: metadata.guide.sources.map((source) => source.url) }
        : {}),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        ...item,
      })),
    },
  ];

  if (metadata.guide?.questions?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: metadata.guide.questions.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export default function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;

    const updateMetadata = async () => {
      const metadata = await getMetadata(pathname);
      if (cancelled) return;

      const canonical = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
      const noindex =
        metadata.noindex ||
        NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix));

      document.title = metadata.title;
      ensureMeta('meta[name="description"]', {
        name: "description",
        content: metadata.description || DEFAULT_DESCRIPTION,
      });
      ensureMeta('meta[name="robots"]', {
        name: "robots",
        content: noindex ? "noindex,follow" : "index,follow",
      });
      ensureMeta('meta[property="og:title"]', {
        property: "og:title",
        content: metadata.title,
      });
      ensureMeta('meta[property="og:description"]', {
        property: "og:description",
        content: metadata.description || DEFAULT_DESCRIPTION,
      });
      ensureMeta('meta[property="og:type"]', {
        property: "og:type",
        content: metadata.type === "article" ? "article" : "website",
      });
      ensureMeta('meta[property="og:url"]', {
        property: "og:url",
        content: canonical,
      });
      ensureMeta('meta[property="og:site_name"]', {
        property: "og:site_name",
        content: "VIASEE",
      });
      ensureMeta('meta[name="twitter:card"]', {
        name: "twitter:card",
        content: "summary_large_image",
      });

      let canonicalLink = document.head.querySelector('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonical;

      const structuredData = buildStructuredData(pathname, metadata, canonical);
      let script = document.getElementById("viasee-route-structured-data");
      if (structuredData) {
        if (!script) {
          script = document.createElement("script");
          script.id = "viasee-route-structured-data";
          script.type = "application/ld+json";
          document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(structuredData);
      } else {
        script?.remove();
      }
    };

    void updateMetadata();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
