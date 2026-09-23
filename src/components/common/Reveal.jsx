import React, { useEffect, useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

// Aparitia la derulare (fade + urcare usoara), facuta cu CSS si IntersectionObserver.
// Stilurile sunt in src/index.css ([data-reveal]).
//
// - Continutul e vizibil din prima randare; ascunderea pentru animatie se face inainte de prima
//   afisare (useLayoutEffect), deci nu clipeste si nu ramane ascuns daca ceva nu merge.
// - Starea se scrie direct pe element (data-reveal), fara re-randare React: pe un telefon lent,
//   zeci de re-randari la incarcare si la derulare se simt.
// - Cu „reducere miscare” activa in sistem, sau fara IntersectionObserver, nu se anima nimic.
// - Se declanseaza o singura data, putin inainte ca elementul sa intre complet pe ecran.
//
// variant: "up" (implicit), "fade", "scale", "slide-in-left" (doar desktop; pe mobil = "up").
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function Reveal({
  as: Tag = "div",
  variant = "up",
  delay = 0,
  threshold = 0.15,
  className = "",
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return undefined;
    node.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      // La demontare (sau la reluarea efectului) elementul nu ramane ascuns.
      if (node.dataset.reveal === "pending") node.dataset.reveal = "shown";
    };
  }, [threshold]);

  const revealStyle = delay ? { ...style, "--reveal-delay": `${delay}ms` } : style;

  return (
    <Tag
      ref={ref}
      className={className}
      style={revealStyle}
      data-reveal-variant={variant}
      {...rest}
    >
      {children}
    </Tag>
  );
}
