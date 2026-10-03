import React from "react";
import { Aperture } from "lucide-react";

export default function SpecialistsLocationArtwork() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative hidden w-full select-none items-center px-5 py-5 lg:flex"
      style={{
        backgroundImage: "radial-gradient(circle, #D7D6D2 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="grid w-full grid-cols-[1fr_1fr_.14fr] overflow-hidden">
        <div
          className="relative flex aspect-square items-center justify-center bg-[#4C5AF4]"
          style={{
            backgroundImage: "url('/images/specialists/cobalt-woven-v2.webp')",
            backgroundSize: "720px auto",
          }}
        >
          <Aperture className="h-[72%] w-[72%] text-[#182359]" strokeWidth={2.8} />
        </div>
        <img
          src="/images/specialists/optical-team-hero-v1.webp"
          alt=""
          width="1254"
          height="1254"
          decoding="async"
          loading="lazy"
          className="aspect-square h-full w-full object-cover"
        />
        <div className="bg-[#FF6B00]" />
      </div>
    </div>
  );
}

