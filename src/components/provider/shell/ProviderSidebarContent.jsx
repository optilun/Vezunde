import React from "react";
import { Check, HelpCircle, LogOut, User as UserIcon } from "lucide-react";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

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
  const accountModes = modeSwitches?.length
    ? modeSwitches
    : modeSwitch
      ? [{ key: "legacy", label: modeSwitch.label, active: false, onClick: modeSwitch.onClick }]
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-card safe-area-bottom">
      <div className="px-4 pt-5 pb-4 shrink-0">
        <div className="flex min-w-0 items-center gap-2.5 pr-8 lg:pr-0">
          <ViaseeBrand compact={Boolean(title)} className="shrink-0" />
          {title && <span className="truncate font-heading text-base sm:text-lg font-bold tracking-tight">{title}</span>}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 pl-9 truncate">{subtitle || "Contul meu"}</p>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 space-y-1">
        {navItems.map((item) => (
          <NavButton key={item.key} item={item} active={activeKey === item.key} onClick={() => onNavigate(item.key)} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-1 shrink-0">
        {accountModes.length > 1 && (
          <div className="mb-2 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-border bg-secondary/20 p-1.5">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Spatiile contului</div>
            {accountModes.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                disabled={item.active}
                className={`mt-0.5 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition touch-manipulation ${item.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground active:bg-card"}`}
              >
                <UserIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        )}
        <a href="mailto:contact@viasee.ro" className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary transition-colors touch-manipulation">
          <HelpCircle className="w-4 h-4 shrink-0" /> Ajutor
        </a>
      </div>

      <div className="px-4 py-4 border-t border-border shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{user?.full_name || "Cont"}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <button type="button" onClick={onLogout} className="mt-3 min-h-11 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary transition-colors touch-manipulation">
          <LogOut className="w-4 h-4" /> Deconectare
        </button>
      </div>
    </div>
  );
}
