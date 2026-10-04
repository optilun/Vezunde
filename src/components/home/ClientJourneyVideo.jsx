import React, { useEffect, useRef, useState } from "react";
import { useInViewport, useMediaQuery, usePrefersReducedMotion } from "@/lib/motion";

export default function ClientJourneyVideo() {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const userPaused = useRef(false);
  const manualPlayback = useRef(false);
  const inView = useInViewport(wrapperRef, { threshold: 0.25 });
  const reducedMotion = usePrefersReducedMotion();
  const mobile = useMediaQuery("(max-width: 639px)");
  const [playing, setPlaying] = useState(false);
  const saveData = typeof navigator !== "undefined" && navigator.connection?.saveData;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      if (!inView || document.hidden || userPaused.current || ((reducedMotion || saveData) && !manualPlayback.current)) video.pause();
      else video.play().catch(() => setPlaying(false));
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [inView, reducedMotion, saveData, mobile]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      manualPlayback.current = true;
      userPaused.current = false;
      video.play().catch(() => setPlaying(false));
    } else {
      userPaused.current = true;
      video.pause();
    }
  };

  return (
    <div ref={wrapperRef} className="relative isolate overflow-hidden rounded-2xl bg-[#4C5AF4] sm:rounded-[1.5rem]"
      style={{ backgroundImage: "url('/images/specialists/cobalt-woven-v2.webp')", backgroundSize: "720px auto" }}>
      <video
        ref={videoRef}
        className="block aspect-[3/4] w-full object-contain sm:aspect-video"
        src={mobile ? "/videos/client-journey-mobile-v5.mp4" : "/videos/client-journey-v5.mp4?v=5.1"}
        poster={mobile ? "/videos/client-journey-mobile-v5-poster.jpg" : "/videos/client-journey-v5-poster.jpg"}
        aria-label="Demonstrație VIASEE cu locații fictive"
        aria-describedby="client-journey-transcript"
        muted loop playsInline preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <track kind="captions" src="/videos/client-journey-ro-v5.vtt" srcLang="ro" label="Română" />
      </video>
      <button type="button" onClick={toggle}
        aria-label={playing ? "Pune demonstrația pe pauză" : "Redă demonstrația"}
        className="absolute inset-0 cursor-pointer bg-transparent outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white" />
      <p id="client-journey-transcript" className="sr-only">Demonstrație cu locații fictive: descrii ce cauți, confirmi nevoia, alegi persoana și localitatea, compari opțiunile și vezi detaliile profilului. Finalul afișează logoul VIASEE și mesajul: Spui ce ai nevoie. Vezi unde poți merge. Lunear Optic Store și Lunear Studio sunt exemple demonstrative. Apasă pe video sau folosește Enter pentru redare și pauză.</p>
    </div>
  );
}
