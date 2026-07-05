import React from "react";
import { LogOut, HelpCircle, User as UserIcon } from "lucide-react";

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

export default function ProviderSidebarContent({ navItems, activeKey, onNavigate, user, onLogout, title, subtitle, modeSwitch }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-sm font-bold bg-foreground shrink-0">V</div>
          <span className="font-heading text-lg font-bold tracking-tight truncate">{title || "vezunde"}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 pl-9 truncate">{subtitle || "Contul meu"}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavButton key={item.key} item={item} active={activeKey === item.key} onClick={() => onNavigate(item.key)} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-0.5">
        {modeSwitch && (
          <button onClick={modeSwitch.onClick} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <UserIcon className="w-4 h-4 shrink-0" /> <span className="truncate">{modeSwitch.label}</span>
          </button>
        )}
        <a href="mailto:contact@vezunde.ro" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
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