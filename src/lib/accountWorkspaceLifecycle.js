export const ACCOUNT_WORKSPACE_FUNCTIONS = Object.freeze({
  provider: "getMyProviderWorkspace",
  professional: "getMyProfessionalWorkspace",
  onboarding: "getMyProviderOnboardingWorkspace",
});

export function accountWorkspaceFunction(workspaceKey) {
  const functionName = ACCOUNT_WORKSPACE_FUNCTIONS[workspaceKey];
  if (!functionName) throw new Error(`Workspace necunoscut: ${workspaceKey}`);
  return functionName;
}

export function keepWorkspaceIdentity(current, next) {
  if (current === next || !current || !next) return next;
  try {
    return JSON.stringify(current) === JSON.stringify(next) ? current : next;
  } catch (_error) {
    return next;
  }
}
