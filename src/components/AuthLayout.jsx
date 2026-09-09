import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

function AuthBrandPanel() {
  return (
    <aside aria-label="Despre VIASEE" className="relative hidden min-h-[640px] overflow-hidden rounded-[32px] border border-[#e3ddd0] bg-[#ede9df] lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col lg:justify-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply" style={{ backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" }} />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-72 w-72 rounded-full border-[36px] border-[#b9c5d8]/35" />
      <div aria-hidden="true" className="pointer-events-none absolute left-8 top-8 h-36 w-48 rotate-[-7deg] overflow-hidden rounded-[24px] border border-white/70 bg-[#fdfbf6] shadow-sm xl:h-44 xl:w-56">
        <img src="/images/home/viasee-artwork-ochelari-lentile.svg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="relative z-10 px-10 py-52 xl:px-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#685f53]">VIASEE · Pentru vederea ta</p>
        <h2 className="mt-5 max-w-lg font-heading text-[clamp(2.5rem,4vw,4.5rem)] font-semibold leading-[1.06] tracking-[-0.045em] text-[#242321]">
          Mai aproape de<br /><span className="text-[#4f6080]">oamenii potriviti.</span>
        </h2>
        <p className="mt-6 max-w-sm text-base leading-7 text-[#635e56]">Optici, clinici si specialisti.<br />Un singur loc de unde sa incepi.</p>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-12 h-52 w-52 rounded-full border-[34px] border-[#bc8067]/20" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-9 right-8 h-36 w-52 rotate-[6deg] overflow-hidden rounded-[24px] border border-white/70 bg-[#fdfbf6] shadow-sm xl:h-44 xl:w-60">
        <img src="/images/home/viasee-artwork-control-vedere.svg" alt="" className="h-full w-full object-cover" />
      </div>
    </aside>
  );
}

export default function AuthLayout({ icon: Icon, title, subtitle = "", footer = null, children, split = false }) {
  if (!split) return (
    <div className="auth-neutral min-h-[100dvh] bg-background px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:flex sm:items-center sm:justify-center sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center sm:mb-10">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary sm:mb-4 sm:h-14 sm:w-14">
            <Icon className="h-6 w-6 text-primary-foreground sm:h-7 sm:w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle && <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">{children}</div>
        {footer && <p className="mt-5 px-2 text-center text-sm leading-6 text-muted-foreground sm:mt-6">{footer}</p>}
      </div>
    </div>
  );

  return (
    <div className="auth-neutral min-h-[100dvh] bg-card text-foreground lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:p-6">
      <div className="flex min-h-[100dvh] min-w-0 flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-12 lg:min-h-[calc(100dvh-3rem)] lg:px-10 lg:py-2 xl:px-16">
        <Link to="/" aria-label="VIASEE - Pagina principala" className="inline-flex min-h-11 w-fit items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          <ViaseeBrand symbolClassName="h-9 w-10" wordmarkClassName="h-6 w-auto" />
        </Link>
        <div className="mx-auto w-full max-w-[400px] flex-1 py-9 sm:py-12 lg:flex lg:flex-col lg:justify-center">
          <Link to="/" className="mb-6 inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />Inapoi la VIASEE
          </Link>
          <h1 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-[36px]">{title}</h1>
          {subtitle && <p className="mt-3 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
          <div className="mt-7 [&_input]:rounded-xl [&_input]:text-base [&_button]:rounded-xl">{children}</div>
          {footer && <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">{footer}</p>}
        </div>
        <nav aria-label="Informatii legale" className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <Link to="/termeni" className="inline-flex min-h-11 items-center underline underline-offset-4">Termeni si conditii</Link>
          <Link to="/confidentialitate" className="inline-flex min-h-11 items-center underline underline-offset-4">Confidentialitate</Link>
        </nav>
      </div>
      <AuthBrandPanel />
    </div>
  );
}

