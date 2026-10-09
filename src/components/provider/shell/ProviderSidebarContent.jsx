import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  HelpCircle,
  LogOut,
  MessageSquareText,
  Plus,
  Settings,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
import FeedbackDialog from "@/components/account/FeedbackDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-h-11 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors touch-manipulation ${
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function workspaceIcon(kind) {
  if (kind === "organization") return Building2;
  if (kind === "professional") return Stethoscope;
  if (kind === "applicant") return ClipboardCheck;
  if (kind === "create") return Plus;
  return CircleUserRound;
}

function WorkspaceAvatar({ item, user, size = "md" }) {
  const Icon = workspaceIcon(item?.kind);
  const avatarUrl = item?.avatarUrl || (item?.kind === "personal" ? user?.profile_photo_url : "");
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = size === "sm" ? "h-8 w-8 rounded-xl" : "h-9 w-9 rounded-xl";
  useEffect(() => setImageFailed(false), [avatarUrl]);
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-secondary text-foreground ${sizeClass}`}>
      {avatarUrl && !imageFailed
        ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
        : <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
    </span>
  );
}

function WorkspaceMenuItem({ item, user }) {
  return (
    <DropdownMenuItem
      disabled={item.active}
      onSelect={() => item.onClick?.()}
      className="min-h-12 cursor-pointer rounded-xl px-2.5 py-2 focus:bg-secondary data-[disabled]:opacity-100"
    >
      <WorkspaceAvatar item={item} user={user} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">{item.label}</span>
        {item.subtitle && <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{item.subtitle}</span>}
      </span>
      {item.active && <Check className="h-3.5 w-3.5 text-foreground" />}
    </DropdownMenuItem>
  );
}

export default function ProviderSidebarContent({
  navItems,
  activeKey,
  onNavigate,
  user,
  onLogout,
  title,
  subtitle,
  modeSwitch,
  modeSwitches,
  entitlement,
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Cardul de upgrade e doar un indemn - nu decide niciun acces - deci foloseste aceeasi
  // conditie simpla ca spotlight-ul din modulul de leaduri (ProviderLeadInboxLegacy): orice
  // plan care nu e "pro" primeste indemnul. Fara entitlement incarcat inca, nu aratam nimic
  // (nu vrem un fals "Treci la Pro" care dispare la fractiuni de secunda).
  const showUpgradeCard = Boolean(entitlement) && entitlement.plan_code !== "pro";
  const accountModes = modeSwitches?.length
    ? modeSwitches
    : modeSwitch
      ? [{ key: "legacy", kind: "personal", group: "account", label: modeSwitch.label, active: true, onClick: modeSwitch.onClick }]
      : [];
  const activeWorkspace = accountModes.find((item) => item.active) || {
    key: "current",
    kind: "personal",
    label: title || "Cont personal",
    subtitle: subtitle || "Contul meu",
  };
  const personalMode = accountModes.find((item) => item.kind === "personal");
  const accountItems = accountModes.filter((item) => item.group !== "organizations");
  const organizationItems = accountModes.filter((item) => item.group === "organizations");
  const initials = (user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col bg-card safe-area-bottom">
      <div className="shrink-0 px-3 pb-3 pt-4">
        <div className="flex min-h-10 items-center px-1.5 pr-10 lg:pr-1.5">
          <ViaseeBrand />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mt-2 flex min-h-14 w-full items-center gap-2.5 rounded-2xl border border-border bg-background px-2.5 py-2 text-left shadow-sm transition hover:bg-secondary/45 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Schimba spatiul contului"
            >
              <WorkspaceAvatar item={activeWorkspace} user={user} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{activeWorkspace.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{activeWorkspace.subtitle || "Spatiu VIASEE"}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border-border p-2 shadow-xl">
            {accountItems.length > 0 && (
              <>
                <DropdownMenuLabel className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Contul tau</DropdownMenuLabel>
                {accountItems.map((item) => <WorkspaceMenuItem key={item.key} item={item} user={user} />)}
              </>
            )}
            {organizationItems.length > 0 && (
              <>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuLabel className="flex items-center justify-between px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span>Organizatii</span>
                  <span>{organizationItems.filter((item) => item.kind === "organization").length}</span>
                </DropdownMenuLabel>
                <div className="max-h-60 overflow-y-auto overscroll-contain">
                  {organizationItems.map((item) => <WorkspaceMenuItem key={item.key} item={item} user={user} />)}
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 space-y-1">
        {navItems.map((item) => (
          <NavButton key={item.key} item={item} active={activeKey === item.key} onClick={() => onNavigate(item.key)} />
        ))}
      </nav>

      {showUpgradeCard && (
        // 2026-10-09 (Alex: „prea mare; mai mic și dreptunghiular, altă culoare”): un singur rând,
        // închis la culoare ca butoanele principale VIASEE, cu accent auriu. Stă sub meniu, deasupra
        // separatorului, ca „Trimite feedback” și „Ajutor și suport” să rămână jos, lângă cont.
        // Linkul are `mode=provider`, ca să rămână în spațiul organizației.
        <div className="shrink-0 px-3 pb-3">
          <Link
            to={`/contul-meu?mode=provider&s=settings&tab=billing${entitlement?.location_id ? "&location=" + encodeURIComponent(entitlement.location_id) : ""}`}
            aria-label="Treci la VIASEE Pro: vezi pachetele, de la 49 RON pe lună"
            className="group flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl bg-[#1b1a17] px-3 py-2 text-left outline-none transition-colors hover:bg-[#2a2823] focus-visible:ring-2 focus-visible:ring-[#c9a85c] focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c9a85c]/15 ring-1 ring-inset ring-[#c9a85c]/40">
              <Sparkles className="h-4 w-4 text-[#e2c88a]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-[13px] font-extrabold tracking-[-0.02em] text-[#fdfbf6]">Treci la Pro</span>
              <span className="block whitespace-nowrap text-[11.5px] tabular-nums text-[#fdfbf6]/60">de la 49 RON/lună</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#e2c88a] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>
      )}

      <div className="shrink-0 border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:bg-secondary"
        >
          <MessageSquareText className="h-4 w-4 shrink-0" />
          <span>Trimite feedback</span>
        </button>
        <Link
          to="/ajutor-si-suport"
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:bg-secondary"
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>Ajutor si suport</span>
        </Link>
      </div>

      <div className="shrink-0 border-t border-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-h-14 w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Deschide meniul contului"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-bold text-accent-foreground">
                {user?.profile_photo_url
                  ? <img src={user.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  : initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{user?.full_name || "Cont VIASEE"}</span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{user?.email}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border-border p-2 shadow-xl">
            <DropdownMenuLabel className="px-2.5 py-2">
              <span className="block truncate text-sm font-bold">{user?.full_name || "Cont VIASEE"}</span>
              <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => personalMode?.onClick?.()} className="min-h-10 cursor-pointer rounded-xl px-2.5">
              <UserRound className="h-4 w-4" /> Cont personal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => (personalMode?.onSettings || personalMode?.onClick)?.()} className="min-h-10 cursor-pointer rounded-xl px-2.5">
              <Settings className="h-4 w-4" /> Setarile contului
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="min-h-10 cursor-pointer rounded-xl px-2.5">
              <Link to="/ajutor-si-suport"><HelpCircle className="h-4 w-4" /> Ajutor si suport</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setFeedbackOpen(true)} className="min-h-10 cursor-pointer rounded-xl px-2.5">
              <MessageSquareText className="h-4 w-4" /> Trimite feedback
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout} className="min-h-10 cursor-pointer rounded-xl px-2.5 text-muted-foreground focus:text-foreground">
              <LogOut className="h-4 w-4" /> Deconectare
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        user={user}
        workspace={activeWorkspace}
      />
    </div>
  );
}
