import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  HelpCircle,
  LogOut,
  MessageSquareText,
  Settings,
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
  return CircleUserRound;
}

function WorkspaceAvatar({ item, user, size = "md" }) {
  const Icon = workspaceIcon(item?.kind);
  const avatarUrl = item?.avatarUrl || (item?.kind === "personal" ? user?.profile_photo_url : "");
  const sizeClass = size === "sm" ? "h-8 w-8 rounded-xl" : "h-9 w-9 rounded-xl";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-secondary text-foreground ${sizeClass}`}>
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
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
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
                  <span>{organizationItems.length}</span>
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
