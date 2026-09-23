import { useEffect, useState } from "react";

// Ajutoare de miscare fara biblioteca de animatie. Home-ul le foloseste in locul framer-motion,
// ca primul ecran sa nu mai astepte descarcarea ei (~40 KB comprimat) inainte sa apara.

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function matches(query) {
  return typeof window !== "undefined" && window.matchMedia?.(query).matches === true;
}

export function prefersReducedMotion() {
  return matches(REDUCED_MOTION_QUERY);
}

export function useMediaQuery(query) {
  const [value, setValue] = useState(() => matches(query));

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = () => setValue(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);

  return value;
}

export function usePrefersReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

// true cat timp elementul e (partial) pe ecran. Fara IntersectionObserver: mereu true.
export function useInViewport(ref, { threshold = 0, rootMargin = "0px" } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);

  return inView;
}
