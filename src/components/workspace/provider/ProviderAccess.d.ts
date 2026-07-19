import type { ComponentType } from "react";

declare const ProviderAccess: ComponentType<{
  organizationId?: string;
  locations?: any[];
  onRefresh?: () => void | Promise<void>;
}>;

export default ProviderAccess;
