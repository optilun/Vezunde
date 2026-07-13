import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle = "", footer = null, children }) {
  return (
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
}
