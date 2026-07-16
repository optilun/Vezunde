import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return undefined;

    if (hash) {
      const id = getHashId(hash);
      let timeoutId = 0;
      let observer;

      const scrollToHash = () => {
        const target = document.getElementById(id);
        if (!target) return false;
        observer?.disconnect();
        window.clearTimeout(timeoutId);
        target.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start",
        });
        return true;
      };

      if (!scrollToHash()) {
        observer = new MutationObserver(scrollToHash);
        observer.observe(document.body, { childList: true, subtree: true });
        timeoutId = window.setTimeout(() => observer.disconnect(), 4000);
      }

      return () => {
        observer?.disconnect();
        window.clearTimeout(timeoutId);
      };
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [pathname, hash, navigationType]);

  return null;
}
