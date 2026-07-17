import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getGuide } from "@/data/specialistGuides";

const DEFAULT_DESCRIPTION =
  "Găsește specialiști, servicii și locații pentru vedere în România. VIASEE te ajută să alegi unde poți merge.";

const STATIC_META = {
  "/": {
    title: "VIASEE — Găsește servicii pentru vedere în România",
    description: DEFAULT_DESCRIPTION,
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
    description: "Adaugă sau revendică profilul tău profesional ori profilul unei locații pe VIASEE.",
    noindex: true,
  },
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
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
}

async function getMetadata(pathname) {
  const guideMatch = pathname.match(/^\/ghid\/(optician-medical|optometrist|medic-oftalmolog)$/);
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
    return { title: "Profil locație | VIASEE", description: DEFAULT_DESCRIPTION };
  }

  if (pathname.startsWith("/specialist/")) {
    return { title: "Profil specialist | VIASEE", description: DEFAULT_DESCRIPTION };
  }

  return STATIC_META[pathname] || {
    title: "Pagina nu a fost găsită | VIASEE",
    description: "Pagina solicitată nu este disponibilă.",
    noindex: true,
  };
}

function buildStructuredData(pathname, metadata, canonical) {
  const organization = {
    "@type": "Organization",
    name: "VIASEE",
    url: window.location.origin,
    email: "contact@viasee.ro",
  };

  if (pathname === "/") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        organization,
        {
          "@type": "WebSite",
          name: "VIASEE",
          url: window.location.origin,
          inLanguage: "ro-RO",
        },
      ],
    };
  }

  if (metadata.type !== "article") return null;

  const breadcrumbs = [
    { name: "VIASEE", item: `${window.location.origin}/` },
    { name: "Ghid", item: `${window.location.origin}/ghid` },
  ];
  if (pathname !== "/ghid") {
    breadcrumbs.push({
      name: metadata.guide?.name || metadata.title.replace(" | VIASEE", ""),
      item: canonical,
    });
  }

  const graph = [
      {
        "@type": "Article",
        headline: metadata.title.replace(" | VIASEE", ""),
        description: metadata.description,
        mainEntityOfPage: canonical,
        inLanguage: "ro-RO",
        dateModified: "2026-07-17",
        author: organization,
        publisher: organization,
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

      const canonical = `${window.location.origin}${pathname === "/" ? "/" : pathname}`;
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
        content: metadata.type || "website",
      });
      ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
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
