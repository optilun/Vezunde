import type { ComponentType } from "react";

declare const ProviderSettings: ComponentType<{
  user: any;
  workspace: any;
  overview: any;
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
  onSwitchMode?: (mode: string) => void;
  onNavigate?: (section: string) => void;
  onRefresh?: () => void | Promise<void>;
}>;

export default ProviderSettings;
