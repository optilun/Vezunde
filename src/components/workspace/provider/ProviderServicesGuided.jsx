import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  ListChecks,
  Send,
  Users,
} from "lucide-react";
import ProviderServicesProgressive from "./ProviderServicesProgressive";

const INITIAL_STATE = {
  selectedCount: 0,
  unitCount: 0,
  issueCount: 0,
  configurationComplete: false,
  statusText: "",
  actionText: "",
};

function cleanText(element) {
  return String(element?.textContent || "").trim().replace(/\s+/g, " ");
}

function firstNumber(element) {
  const match = cleanText(element).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export default function ProviderServicesGuided(props) {
  const rootRef = useRef(null);
  const [state, setState] = useState(INITIAL_STATE);

  const readState = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const metrics = [...root.querySelectorAll(".provider-services-progressive__metrics > span")];
    const selectedCount = firstNumber(metrics.find((item) => /opțiuni|optiuni/i.test(cleanText(item))));
    const unitCount = firstNumber(metrics.find((item) => /spații|spatii/i.test(cleanText(item))));
    const issueCount = root.querySelectorAll('[data-service-issue="true"][aria-pressed="true"]').length;
    const careSection = root.querySelector('[data-services-configuration-index="3"]');
    const careSettingComplete = !careSection || Boolean(careSection.querySelector('button[aria-pressed="true"]'));
    const configurationComplete = unitCount > 0 && careSettingComplete;
    const statusText = cleanText(root.querySelector(".provider-services-progressive__eyebrow span:first-child"));
    const actionText = cleanText(root.querySelector('[data-services-role="actions"]'));

    setState((current) => {
      const next = {
        selectedCount,
        unitCount,
        issueCount,
        configurationComplete,
        statusText,
        actionText,
      };
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    readState();
    const observer = new MutationObserver(readState);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-pressed", "class", "disabled", "data-service-issue"],
    });
    return () => observer.disconnect();
  }, [readState]);

  const progress = useMemo(() => {
    const servicesComplete = state.selectedCount > 0;
    const requirementsComplete = servicesComplete && state.issueCount === 0;
    const pendingReview = /verificare/i.test(`${state.statusText} ${state.actionText}`);
    const dirty = /modificări nesalvate|modificari nesalvate/i.test(state.actionText);
    const draftSaved = /draft salvat/i.test(state.actionText);

    const currentStep = !state.configurationComplete
      ? 1
      : !servicesComplete
        ? 2
        : !requirementsComplete
          ? 3
          : 4;

    return {
      currentStep,
      pendingReview,
      steps: [
        {
          id: 1,
          label: "Configurează locația",
          description: "Spații, activități și mod de funcționare",
          icon: Building2,
          done: state.configurationComplete,
          status: state.configurationComplete ? "Complet" : "Începe aici",
        },
        {
          id: 2,
          label: "Alege serviciile",
          description: "Oferta disponibilă în fiecare spațiu",
          icon: ListChecks,
          done: servicesComplete,
          status: servicesComplete ? `${state.selectedCount} selectate` : "Urmează",
        },
        {
          id: 3,
          label: "Completează cerințele",
          description: "Specialiști, echipamente și facilități",
          icon: Users,
          done: requirementsComplete,
          status: state.issueCount > 0 ? `${state.issueCount} de rezolvat` : servicesComplete ? "Complet" : "După servicii",
          attention: state.issueCount > 0,
        },
        {
          id: 4,
          label: "Salvează și trimite",
          description: "Verifică modificările și trimite cererea",
          icon: Send,
          done: pendingReview,
          status: pendingReview ? "În verificare" : dirty ? "Nesalvat" : draftSaved ? "Draft salvat" : "Ultimul pas",
        },
      ],
    };
  }, [state]);

  const goToStep = useCallback((stepId) => {
    const root = rootRef.current;
    if (!root) return;

    let target = null;
    if (stepId === 1) {
      const progressive = root.querySelector(".provider-services-progressive");
      if (progressive?.classList.contains("is-configuration-collapsed")) {
        progressive.querySelector(".provider-services-progressive__configuration-button")?.click();
      }
      target = root.querySelector(".provider-services-progressive__configuration");
    } else if (stepId === 2) {
      target = root.querySelector(".provider-services-progressive__catalog-toolbar")
        || root.querySelector('[data-services-role="unit-list"]');
    } else if (stepId === 3) {
      target = root.querySelector('[data-services-role="resources"][data-services-needed="true"]')
        || root.querySelector('[data-services-role="unit-list"]');
      if (state.issueCount > 0) {
        const issueFilter = [...root.querySelectorAll(".provider-services-progressive__filters button")]
          .find((button) => /completare/i.test(cleanText(button)));
        issueFilter?.click();
      }
    } else {
      target = root.querySelector('[data-services-role="actions"]')
        || root.querySelector(".provider-services-progressive__advanced-toggle")
        || root.querySelector(".provider-services-polish");
    }

    requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      target?.querySelector?.("button, input, select")?.focus({ preventScroll: true });
    });
  }, [state.issueCount]);

  return (
    <div ref={rootRef} className="provider-services-guided">
      <section className="provider-services-guided__guide" aria-labelledby="provider-services-guide-title">
        <div className="provider-services-guided__guide-header">
          <div>
            <p>Ordinea configurării</p>
            <h2 id="provider-services-guide-title">Parcurge cei 4 pași în ordine</h2>
          </div>
          <span>Poți reveni oricând la un pas anterior.</span>
        </div>

        <div className="provider-services-guided__steps">
          {progress.steps.map((step) => {
            const current = progress.currentStep === step.id && !progress.pendingReview;
            return (
              <button
                key={step.id}
                type="button"
                className={`${step.done ? "is-done" : ""} ${current ? "is-current" : ""} ${step.attention ? "has-attention" : ""}`}
                aria-current={current ? "step" : undefined}
                onClick={() => goToStep(step.id)}
              >
                <span className="provider-services-guided__step-marker">
                  {step.done ? <Check aria-hidden="true" /> : <span>{step.id}</span>}
                </span>
                <span className="provider-services-guided__step-copy">
                  <strong>{step.label}</strong>
                  <small>{step.description}</small>
                  <em>{step.status}</em>
                </span>
                <ChevronRight className="provider-services-guided__step-arrow" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <ProviderServicesProgressive {...props} />
    </div>
  );
}
