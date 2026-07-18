import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardCheck,
  ListChecks,
  Users,
} from "lucide-react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";
import "./ProviderServicesClean.css";

const SERVICE_STAGES = [
  {
    id: "structure",
    label: "Spații și activitate",
    shortLabel: "Spații",
    description: "Declară spațiile care există în locație, activitățile speciale și modul de funcționare.",
    icon: Building2,
  },
  {
    id: "services",
    label: "Servicii și opțiuni",
    shortLabel: "Servicii",
    description: "Selectează opțiunile generale și oferta disponibilă în fiecare spațiu al locației.",
    icon: ListChecks,
  },
  {
    id: "resources",
    label: "Specialiști și dotări",
    shortLabel: "Resurse",
    description: "Asociază specialiștii, echipamentele și facilitățile cu spațiile în care sunt folosite.",
    icon: Users,
  },
  {
    id: "review",
    label: "Rezumat și trimitere",
    shortLabel: "Rezumat",
    description: "Verifică structura și serviciile care vor deveni publice înainte de trimitere.",
    icon: ClipboardCheck,
  },
];

function sectionStage(element) {
  const heading = element.querySelector("h2")?.textContent?.trim() || "";
  const copy = element.textContent?.trim() || "";

  if (/^[123]\./.test(heading)) return "structure";
  if (/^[45]\./.test(heading) || heading.startsWith("Rezultate pentru")) return "services";
  if (copy.includes("Date existente care necesita migrare") || copy.includes("Date existente care necesită migrare")) return "review";
  return "";
}

function decorateOperationalWorkspace(root) {
  if (!root) return;

  const operationalRoot = root.querySelector(":scope > div");
  if (!operationalRoot) return;

  const intro = operationalRoot.querySelector(":scope > section:first-child");
  if (intro) intro.dataset.servicesStage = "services";

  const mainGrid = [...operationalRoot.children].find((element) => (
    element instanceof HTMLElement
    && element.classList.contains("grid")
    && String(element.className).includes("xl:grid-cols")
  ));
  if (!mainGrid) return;

  mainGrid.dataset.servicesWorkspace = "main";
  const mainColumn = [...mainGrid.children].find((element) => element.classList?.contains("space-y-4"));
  const summary = [...mainGrid.children].find((element) => element.tagName === "ASIDE");

  if (mainColumn) {
    mainColumn.dataset.servicesColumn = "content";
    [...mainColumn.children].forEach((element) => {
      delete element.dataset.servicesStage;
      if (element.classList?.contains("space-y-3")) {
        element.dataset.servicesStage = "catalog";
        return;
      }
      const stage = sectionStage(element);
      if (stage) element.dataset.servicesStage = stage;
    });
  }

  if (summary) summary.dataset.servicesStage = "review";
}

export default function ProviderServices(props) {
  const [activeStage, setActiveStage] = useState("structure");
  const contentRef = useRef(null);

  const activeIndex = SERVICE_STAGES.findIndex((item) => item.id === activeStage);
  const currentStage = SERVICE_STAGES[activeIndex] || SERVICE_STAGES[0];

  const clearSearch = useCallback(() => {
    const input = contentRef.current?.querySelector('input[placeholder^="Caută"], input[placeholder^="Cauta"]');
    if (!input?.value) return;
    const clearButton = input.parentElement?.querySelector("button");
    clearButton?.click();
  }, []);

  const changeStage = useCallback((stageId) => {
    if (stageId !== "services") clearSearch();
    setActiveStage(stageId);
    requestAnimationFrame(() => {
      document.querySelector(".provider-services-task__panel-header")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [clearSearch]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return undefined;

    const decorate = () => decorateOperationalWorkspace(root);
    decorate();

    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const stageClass = useMemo(() => `provider-services-task--${activeStage}`, [activeStage]);
  const CurrentIcon = currentStage.icon;

  return (
    <div className={`provider-services-task ${stageClass}`}>
      <aside className="provider-services-task__navigation" aria-label="Etapele configurării serviciilor">
        <div className="provider-services-task__navigation-title">
          <span>Configurarea locației</span>
          <strong>4 etape</strong>
        </div>

        <nav className="provider-services-task__steps">
          {SERVICE_STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const active = stage.id === activeStage;
            return (
              <button
                key={stage.id}
                type="button"
                aria-current={active ? "step" : undefined}
                className={active ? "is-active" : ""}
                onClick={() => changeStage(stage.id)}
              >
                <span className="provider-services-task__step-number">{index + 1}</span>
                <Icon className="provider-services-task__step-icon" aria-hidden="true" />
                <span className="provider-services-task__step-copy">
                  <strong>{stage.label}</strong>
                  <small>{stage.shortLabel}</small>
                </span>
                <ArrowRight className="provider-services-task__step-arrow" aria-hidden="true" />
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="provider-services-task__content">
        <header className="provider-services-task__panel-header">
          <div className="provider-services-task__panel-heading">
            <span className="provider-services-task__panel-icon"><CurrentIcon aria-hidden="true" /></span>
            <div>
              <p>Etapa {activeIndex + 1} din {SERVICE_STAGES.length}</p>
              <h2>{currentStage.label}</h2>
              <span>{currentStage.description}</span>
            </div>
          </div>

          <div className="provider-services-task__panel-controls" aria-label="Navigare între etape">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => changeStage(SERVICE_STAGES[activeIndex - 1]?.id)}
            >
              <ArrowLeft aria-hidden="true" /> Înapoi
            </button>
            <button
              type="button"
              disabled={activeIndex === SERVICE_STAGES.length - 1}
              onClick={() => changeStage(SERVICE_STAGES[activeIndex + 1]?.id)}
            >
              Continuă <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </header>

        <div
          ref={contentRef}
          className="provider-services-polish"
          onFocusCapture={(event) => {
            if (event.target instanceof HTMLInputElement && event.target.placeholder.toLowerCase().startsWith("caut")) {
              setActiveStage("services");
            }
          }}
        >
          <ProviderServicesWorkspaceRuntime {...props} />
        </div>
      </main>
    </div>
  );
}
