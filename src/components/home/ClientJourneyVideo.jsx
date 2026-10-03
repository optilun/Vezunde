import React, { useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, RotateCcw } from "lucide-react";
import { useInViewport, useMediaQuery, usePrefersReducedMotion } from "@/lib/motion";

const CHAPTERS = [
  { title: "Spui ce cauți", short: "Descrii", time: 0 },
  { title: "Răspunzi pe scurt", short: "Răspunzi", time: 6 },
  { title: "Compari opțiunile", short: "Compari", time: 19 },
];

export default function ClientJourneyVideo() {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const userPaused = useRef(false);
  const manualPlayback = useRef(false);
  const inView = useInViewport(wrapperRef, { threshold: 0.25 });
  const reducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const mobile = useMediaQuery("(max-width: 639px)");
  const saveData = typeof navigator !== "undefined" && navigator.connection?.saveData;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!inView || document.hidden || userPaused.current || ((reducedMotion || saveData) && !manualPlayback.current)) {
      video.pause();
      return;
    }
    video.play().catch(() => setPlaying(false));
  }, [inView, reducedMotion, saveData]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) videoRef.current?.pause(); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const play = () => {
    manualPlayback.current = true;
    userPaused.current = false;
    videoRef.current?.play().catch(() => setPlaying(false));
  };

  const toggle = () => {
    if (playing) {
      userPaused.current = true;
      videoRef.current?.pause();
    } else play();
  };

  const goTo = (time) => {
    const video = videoRef.current;
    if (!video) return;
    const seek = () => { video.currentTime = time; setCurrentTime(time); play(); };
    if (video.readyState >= 1) seek();
    else {
      video.addEventListener("loadedmetadata", seek, { once: true });
      video.load();
    }
  };

  const fullscreen = () => {
    const video = videoRef.current;
    if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else video?.requestFullscreen?.().catch(() => {});
  };

  const activeChapter = currentTime >= 19 ? 2 : currentTime >= 6 ? 1 : 0;

  return (
    <div ref={wrapperRef} className="mt-8 sm:mt-12">
      <div className="relative isolate overflow-hidden rounded-2xl border border-black/10 bg-[#344ae7] shadow-[0_8px_28px_rgba(28,24,18,0.08)] sm:rounded-[1.5rem]">
        <video
          ref={videoRef}
          className="block aspect-[3/4] w-full object-contain sm:aspect-[8/5]"
          src={mobile ? "/videos/client-journey-mobile-v1.mp4" : "/videos/client-journey-v1.mp4"}
          poster={mobile ? "/videos/client-journey-mobile-poster-v1.jpg" : "/videos/client-journey-poster-v1.jpg"}
          aria-label="Demonstrație VIASEE: descrii ce cauți, confirmi nevoia, alegi persoana și localitatea, apoi compari rezultatele."
          muted
          loop
          playsInline
          preload="none"
          controls={failed}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onError={() => setFailed(true)}
        >
          <track kind="captions" src="/videos/client-journey-ro-v1.vtt" srcLang="ro" label="Română" default />
          Browserul tău nu poate reda video-ul. Descrie ce cauți, răspunde la întrebări și compară opțiunile din zona ta.
        </video>
        {!playing && !failed && (
          <button
            type="button"
            onClick={play}
            aria-label="Redă demonstrația pentru clienți"
            className="absolute inset-0 grid place-items-center bg-black/10 outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/40 bg-[#171717] text-white shadow-lg sm:h-20 sm:w-20">
              <Play className="h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden="true" />
            </span>
          </button>
        )}
        <div className="absolute bottom-3 right-3 flex gap-2 sm:bottom-4 sm:right-4">
          <button type="button" onClick={toggle} aria-label={playing ? "Pune demonstrația pe pauză" : "Redă demonstrația"} className="grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-[#171717] text-white outline-none focus-visible:ring-2 focus-visible:ring-white">
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => goTo(0)} aria-label="Reia demonstrația de la început" className="grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-[#171717] text-white outline-none focus-visible:ring-2 focus-visible:ring-white">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={fullscreen} aria-label="Vezi demonstrația pe tot ecranul" className="grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-[#171717] text-white outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Maximize className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Pașii demonstrației">
        {CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.title}
            type="button"
            onClick={() => goTo(chapter.time)}
            aria-label={"Vezi pasul " + (index + 1) + ": " + chapter.title}
            aria-pressed={activeChapter === index}
            className={"flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#345bc8] motion-reduce:transition-none sm:justify-start sm:px-5 sm:text-base " + (activeChapter === index ? "border-[#345bc8]/30 bg-[#e9edf8] text-[#254bad]" : "border-black/10 bg-[#f7f5ef] text-foreground/70 hover:border-black/25")}
          >
            <span className="font-mono text-[10px] opacity-60 sm:text-xs">0{index + 1}</span>
            <span className="sm:hidden">{chapter.short}</span>
            <span className="hidden sm:inline">{chapter.title}</span>
          </button>
        ))}
      </div>
      {failed && <p role="status" className="mt-3 text-sm text-muted-foreground">Video-ul nu s-a încărcat. Îl poți reîncerca folosind butonul de redare.</p>}
      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">Exemplu de căutare pentru un control de vedere. Întrebările și rezultatele pot varia.</p>
    </div>
  );
}
