export interface ProviderServiceSection {
  key: string;
  unitKey: string;
  fallbackUnitKeys?: string[];
  capabilityKey?: string | null;
  scope?: 'location' | 'unit';
  area: string;
  kind: string;
  title: string;
  publicNeedKey?: string | null;
  publicLabel?: string;
  description?: string;
  note?: string;
  searchTerms?: string[];
  items: Array<{ group: string; id: string }>;
  [key: string]: unknown;
}

export interface ServiceOperationalContext {
  serviceKey: string;
  group: string;
  sectionKey: string;
  unitKey: string;
  fallbackUnitKeys: string[];
  capabilityKey: string | null;
  publicNeedKey: string | null;
  kind: string;
  scope?: 'location' | 'unit';
}

export const PROVIDER_SERVICE_SECTIONS: ProviderServiceSection[];
export const PUBLIC_NEED_SECTIONS: Array<{ key: string; label: string }>;
export const CURATED_SERVICE_SEARCH_SYNONYMS: Record<string, string[]>;
export const SERVICE_OPERATIONAL_CONTEXT: Record<string, ServiceOperationalContext>;

export function getServiceOperationalContext(serviceKey: unknown): ServiceOperationalContext | null;
export function getProviderServiceSections(): ProviderServiceSection[];
export function getPublicNeedSections(): Array<{ key: string; label: string }>;
export function getServiceSearchTerms(serviceKey: string): string[];
export function validateOperationalTaxonomy(): {
  valid: boolean;
  duplicates: string[];
  unknown: string[];
  missing: string[];
  total: number;
};
