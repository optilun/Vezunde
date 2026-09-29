import { useEffect, useRef, useState } from "react";

// Inaltimea antetului si a controalelor de cautare (pentru pozitiile fixate de pe desktop) si
// momentul in care controalele ies din ecran (pe telefon apare atunci bara compacta).
// 2026-09-29 (audit /cauta, D3): mutat din Search.jsx, neschimbat.
export default function useStickySearchControls() {
  const controlsRef = useRef(null);
  const [stickySize, setStickySize] = useState({ nav: 80, controls: 160 });
  useEffect(() => {
    const headers = [...document.querySelectorAll("header")];
    const measure = () => {
      const header = headers.find((element) => element.getBoundingClientRect().height > 0);
      const nav = Math.ceil(header?.getBoundingClientRect().height || 0);
      const controls = Math.ceil(controlsRef.current?.getBoundingClientRect().height || 0);
      setStickySize((previous) => previous.nav === nav && previous.controls === controls ? previous : { nav, controls });
    };
    measure();
    const observer = new ResizeObserver(measure);
    headers.forEach((header) => observer.observe(header));
    if (controlsRef.current) observer.observe(controlsRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  // A2: pe telefon si tableta controalele nu mai sunt fixate; cand ies de sub antet, apare bara
  // compacta. Pe desktop controalele sunt `lg:sticky`, deci raman vizibile si bara nu apare (lg:hidden).
  const [controlsOut, setControlsOut] = useState(false);
  useEffect(() => {
    const element = controlsRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setControlsOut(!entry.isIntersecting && entry.boundingClientRect.top < stickySize.nav),
      { rootMargin: `-${stickySize.nav}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [stickySize.nav]);
  return { controlsRef, stickySize, controlsOut };
}
