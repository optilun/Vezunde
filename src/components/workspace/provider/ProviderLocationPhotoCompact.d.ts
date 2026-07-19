import type { ComponentType } from "react";

declare const ProviderLocationPhotoCompact: ComponentType<{
  locationId: string;
  onRefresh?: () => void;
}>;

export default ProviderLocationPhotoCompact;
