import React, { useCallback, useRef } from "react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";
import "./ProviderServicesClean.css";

const SERVICE_NAV_ITEMS = [
  { label: "Configurare", target: "1. Spațiile" },
  { label: "Opțiuni generale", target: "4. Opțiuni" },
  { label: "Catalog servicii", target: "5. Produse" },
  { label: "Rezumat", target: "Progres configurare" },
];

export default function ProviderServices(props) {
  const contentRef = useRef(null);

  const scrollToSection = useCallback((target) => {
    const root = contentRef.current;
    if (!root) return;

    const heading = [...root.querySelectorAll("h2")]
      .find((item) => item.textContent?.trim().startsWith(target));
    const section = heading?.closest("section, aside");

    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    section?.querySelector("button, input, select")?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="provider-services-clean">
      <div className="provider-services-clean__navigation" aria-label="Navigare rapidă în configurarea serviciilor">
        <div className="provider-services-clean__navigation-copy">
          <strong>Configurează în ordinea potrivită</strong>
          <span>Spații, opțiuni generale, servicii și verificarea finală.</span>
        </div>
        <div className="provider-services-clean__navigation-actions" role="group" aria-label="Secțiuni servicii">
          {SERVICE_NAV_ITEMS.map((item) => (
            <button key={item.target} type="button" onClick={() => scrollToSection(item.target)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={contentRef} className="provider-services-polish">
        <ProviderServicesWorkspaceRuntime {...props} />
      </div>
    </div>
  );
}
