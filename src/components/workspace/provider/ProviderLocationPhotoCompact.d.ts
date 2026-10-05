import type { ComponentType } from "react";

declare const ProviderLocationPhotoCompact: ComponentType<{
  locationId: string;
  onRefresh?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}>;

export default ProviderLocationPhotoCompact;
