import React, { createContext, useContext } from "react";

const DEFAULT_PROVIDER_ACCESS_STATE = {
  data: null,
  loading: false,
  resolved: false,
  error: "",
  organizationId: "",
  onRetry: null,
};

const ProviderAccessStateContext = createContext(DEFAULT_PROVIDER_ACCESS_STATE);

export function ProviderAccessStateProvider({ value, children }) {
  return (
    <ProviderAccessStateContext.Provider value={value || DEFAULT_PROVIDER_ACCESS_STATE}>
      {children}
    </ProviderAccessStateContext.Provider>
  );
}

export function useProviderAccessState() {
  return useContext(ProviderAccessStateContext);
}
