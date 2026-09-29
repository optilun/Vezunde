import { useEffect, useRef } from "react";

// Pozitia paginii se salveaza dupa ce derularea se opreste (si la plecarea de pe pagina), nu la
// fiecare eveniment: fiecare salvare citeste si rescrie toata sesiunea de cautare (pana la ~35 KB),
// iar pe telefon asta facea derularea sacadata (2026-09-24, audit /cauta B5).
// Ultima pozitie se tine la fiecare eveniment (citire ieftina), ca salvarea de la plecare sa nu
// citeasca pozitia paginii urmatoare.
//
// 2026-09-29 (audit /cauta, D3): acelasi cod era scris de doua ori (Search.jsx si DirectoryMap.jsx).
// `save(y)` decide ce si unde se scrie; se citeste mereu ultima versiune a functiei.
export default function useRememberScroll(save, delay = 200) {
  const saveLatest = useRef(save);
  saveLatest.current = save;
  useEffect(() => {
    let timer = 0;
    let lastY = window.scrollY;
    let pending = false;
    const flush = () => {
      clearTimeout(timer);
      timer = 0;
      if (!pending) return;
      pending = false;
      saveLatest.current(lastY);
    };
    const onScroll = () => {
      lastY = window.scrollY;
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [delay]);
}
