import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/common/Reveal";
import CategoryStrip from "@/components/home/CategoryStrip";
import { prefetchOnIntent } from "@/lib/routePrefetch";

// Secțiunea „Servicii și specialiști”: titlul, banda de categorii (file + plăcuțe care se schimbă
// singure, vezi CategoryStrip.jsx) și trimiterea spre ghid. Aceeași bandă pe desktop și pe telefon.
export default function CategoryShowcase() {
  const headingId = "home-categories-title";

  return (
    <section aria-labelledby={headingId} className="relative pb-8 pt-10 sm:pb-10 sm:pt-12 lg:pb-14 lg:pt-12">
      <div className="relative z-10 mx-auto max-w-[84rem] px-5">
        <Reveal className="text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75 sm:text-[11px]">
            Servicii și specialiști
          </p>
          <h2 id={headingId} className="mx-auto mt-4 max-w-[68rem] text-balance font-heading text-[2.4rem] font-extrabold leading-[1.06] tracking-[-0.055em] min-[390px]:text-[2.6rem] sm:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem]">
            <span className="block lg:whitespace-nowrap">Tot ce ai nevoie pentru vedere.</span>
            <span className="block">Într-un singur loc.</span>
          </h2>
        </Reveal>

        <Reveal delay={80} className="mt-9 sm:mt-11">
          <CategoryStrip />
        </Reveal>

        <Reveal delay={120} className="mt-10 flex justify-center sm:mt-12 lg:mt-14">
          <Link
            to="/ghid"
            aria-label="Vezi ghidul VIASEE"
            {...prefetchOnIntent("/ghid")}
            className="group inline-flex min-h-14 items-center gap-5 rounded-full bg-[#171717] py-2 pl-7 pr-2 text-white shadow-[0_16px_38px_rgba(18,18,18,0.15)] outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(18,18,18,0.2)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-8 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:min-h-[4.5rem] sm:gap-8 sm:pl-10"
          >
            <span aria-hidden="true" className="order-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f8f4ec] text-[#171717] sm:h-14 sm:w-14">
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none sm:h-7 sm:w-7" />
            </span>
            <span className="font-heading text-2xl font-bold leading-none tracking-[-0.035em] sm:text-[2rem]">Vezi ghidul complet</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
