import React from "react";
import { Link } from "react-router-dom";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

function AuthBrandPanel() {
  return (
    <aside aria-label="Despre VIASEE" className="relative hidden min-h-[640px] overflow-hidden rounded-[24px] bg-[#f7f4ec] lg:sticky lg:top-6 lg:block lg:h-[calc(100dvh-3rem)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/auth/viasee-auth-artwork-v1.webp')" }}
      />
      <div className="absolute inset-x-[7%] top-1/2 -translate-y-1/2 text-center">
        <h2 className="font-heading text-[clamp(1.75rem,2.5vw,3rem)] font-semibold leading-[1.12] tracking-[-0.045em] text-[#191919]">
          <span className="block">Tot ce ai nevoie</span>
          <span className="block">pentru vedere.</span>
          <span className="block">Într-un singur loc.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[340px] text-sm leading-6 text-[#625e55]">
          Medici, clinici, controale, investigații,<br />ochelari și reparații.
        </p>
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
        <Link to="/" aria-label="VIASEE — Pagina principală" className="inline-flex min-h-11 w-fit items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          <ViaseeBrand symbolClassName="h-9 w-10" wordmarkClassName="h-6 w-auto" />
        </Link>
        <main className="mx-auto flex w-full max-w-[384px] flex-1 flex-col justify-center py-12 sm:py-14">
          <h1 className="font-heading text-[30px] font-semibold leading-tight tracking-[-0.04em] sm:text-[32px]">{title}</h1>
          {subtitle && <p className="mt-3 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
          <div className="mt-7 [&_input]:rounded-lg [&_input]:text-base [&_button]:rounded-lg">{children}</div>
          {footer && <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">{footer}</p>}
        </main>
        <nav aria-label="Informații legale" className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <Link to="/termeni" className="inline-flex min-h-11 items-center underline underline-offset-4">Termeni și condiții</Link>
          <Link to="/confidentialitate" className="inline-flex min-h-11 items-center underline underline-offset-4">Confidențialitate</Link>
        </nav>
      </div>
      <AuthBrandPanel />
    </div>
  );
}

