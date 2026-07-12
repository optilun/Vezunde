import React from "react";
import { Check, HelpCircle, LogOut, User as UserIcon } from "lucide-react";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <ViaseeBrand compact={Boolean(title)} className="shrink-0" />
          {title && <span className="truncate font-heading text-lg font-bold tracking-tight">{title}</span>}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 pl-9 truncate">{subtitle || "Contul meu"}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavButton key={item.key} item={item} active={activeKey === item.key} onClick={() => onNavigate(item.key)} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-0.5">
        {accountModes.length > 1 && (
          <div className="mb-2 rounded-xl border border-border bg-secondary/20 p-1.5">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Spatiile contului</div>
            {accountModes.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                disabled={item.active}
                className={`mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${item.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}
              >
                <UserIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        )}
        <a href="mailto:contact@viasee.ro" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <HelpCircle className="w-4 h-4 shrink-0" /> Ajutor
        </a>
      </div>

      <div className="px-4 py-4 border-t border-border">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{user?.full_name || "Cont"}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <button onClick={onLogout} className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" /> Deconectare
        </button>
      </div>
    </div>
  );
}
