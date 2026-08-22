// Actualizare aproape live a conversatiei controlate.
//
// VIASEE nu are (inca) un canal push real, iar pana acum conversatia se reimprospata doar
// manual, din butonul "Actualizeaza": daca celalalt scria, nu vedeai nimic pana nu apasai tu.
// Aici facem un polling scurt, dar disciplinat:
//   - numai cat timp conversatia e efectiv deschisa (nu pe istoric, nu pe conversatii inchise
//     si nu pe cele nedeschise inca - acolo nu se poate schimba nimic fara o actiune explicita);
//   - numai cat timp fila e vizibila, ca sa nu batem backendul pentru taburi uitate deschise;
//   - niciodata peste o actiune in curs (trimitere / inchidere / deschidere), ca sa nu suprascriem
//     raspunsul actiunii cu un status mai vechi;
//   - reimprospatarea e "silentioasa": nu aprinde spinnerul de incarcare si nu afiseaza erori,
//     ca sa nu palpaie UI-ul la fiecare ciclu.
//
// Daca se decide ulterior trecerea la SSE/websocket, acesta e singurul loc care trebuie inlocuit:
// componentele nu stiu cum sunt anuntate, doar ca trebuie sa reincarce.
import { useEffect, useRef } from "react";

export const CHAT_POLL_INTERVAL_MS = 8000;

export default function useChatLivePolling({ active, busy, onPoll }) {
  const onPollRef = useRef(onPoll);
  const busyRef = useRef(busy);
  const inFlightRef = useRef(false);

  useEffect(() => { onPollRef.current = onPoll; }, [onPoll]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (!active) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      // busyRef: actiune declansata de utilizator in curs. inFlightRef: ciclu anterior inca
      // nefinalizat (retea lenta) - fara el s-ar putea suprapune doua cereri de status.
      if (busyRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await onPollRef.current?.();
      } catch (_error) {
        // Un ciclu esuat nu se afiseaza: urmatorul reincearca, iar butonul manual ramane acolo.
      } finally {
        inFlightRef.current = false;
      }
    };

    const timer = window.setInterval(() => void tick(), CHAT_POLL_INTERVAL_MS);
    // La revenirea pe fila aducem imediat ce s-a schimbat cat timp utilizatorul a lipsit,
    // fara sa mai asteptam urmatorul ciclu.
    const handleVisibility = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active]);
}
