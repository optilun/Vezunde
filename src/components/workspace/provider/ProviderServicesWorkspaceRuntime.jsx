import ProviderServicesWorkspaceOperational from "./ProviderServicesWorkspaceOperational";

// The V2 catalog is available locally in the application bundle. The operational
// workspace decides whether persistence uses V2 endpoints or the guarded legacy
// submission fallback; it must never hide V2 services solely because an endpoint
// has not been deployed yet.
export default function ProviderServicesWorkspaceRuntime(props) {
  return <ProviderServicesWorkspaceOperational {...props} />;
}
