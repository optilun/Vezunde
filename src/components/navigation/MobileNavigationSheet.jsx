import React from "react";
import { Link, NavLink } from "react-router-dom";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const MOBILE_LINKS = [
  { to: "/cauta", label: "Caută" },
  { to: "/ghid", label: "Ghid pentru vedere" },
  { to: "/parteneri", label: "Parteneri" },
  { to: "/pentru-specialisti", label: "Pentru specialiști" },
  { to: "/adauga-sau-revendica", label: "Adaugă sau revendică un profil" },
];

export default function MobileNavigationSheet({ open, onOpenChange }) {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(22rem,calc(100vw-1rem))] overflow-y-auto p-0 safe-area-top safe-area-bottom"
      >
        <SheetHeader className="border-b border-border px-5 py-5 text-left">
          <SheetTitle className="sr-only">Navigație VIASEE</SheetTitle>
          <ViaseeBrand
            symbolClassName="h-8 w-8"
            wordmarkClassName="h-[18px] w-auto"
          />
        </SheetHeader>

        <div className="space-y-1 px-4 py-5">
          {MOBILE_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={close}
              className={({ isActive }) =>
                `flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "hover:bg-secondary"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="border-t border-border px-4 py-5">
          <Link
            to="/cerere"
            onClick={close}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#171717] px-5 text-sm font-semibold text-white"
          >
            Găsește opțiuni
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
