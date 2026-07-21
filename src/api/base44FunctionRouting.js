export const BASE44_FUNCTION_ROUTES = {
  "adminDataIntegrityOps": "directoryOps",
  "adminDirectoryCorrectionReview": "directoryOps",
  "adminOrganizationProfileReview": "directoryOps",
  "adminProfessionalProfileReview": "directoryOps",
  "adminProviderClaimReview": "directoryOps",
  "adminProviderScopedClaimReview": "directoryOps",
  "adminServiceConfigurationReview": "directoryOps",
  "adminServicePrerequisiteReview": "directoryOps",
  "adminWorkspaceReview": "directoryOps",
  "aiResearchOps": "directoryOps",
  "backfillLocationServiceMatching": "directoryOps",
  "backfillProviderOrganizationProfile": "directoryOps",
  "directoryImportOps": "directoryOps",
  "directoryMappingOps": "directoryOps",
  "geoImportOps": "directoryOps",
  "getAdminServiceManagementData": "directoryOps",
  "researchOps": "directoryOps",
  "reviewProfileChanges": "directoryOps",
  "getMyAccountDeletionEligibility": "getMyProviderWorkspace",
  "getMyProviderMembers": "getMyProviderWorkspace",
  "getMyProviderOnboardingWorkspace": "getMyProviderWorkspace",
  "getProviderEntitlement": "getMyProviderWorkspace",
  "getProviderLocationComparison": "getMyProviderWorkspace",
  "getProviderLogoReviewStatus": "getMyProviderWorkspace",
  "getProviderProfileCompleteness": "getMyProviderWorkspace",
  "getProviderWorkspaceOverview": "getMyProviderWorkspace",
  "acceptProviderMemberInvitation": "createProviderMemberInvitation",
  "deactivateProviderMember": "createProviderMemberInvitation",
  "reactivateProviderMember": "createProviderMemberInvitation",
  "revokeProviderMemberInvitation": "createProviderMemberInvitation",
  "listProviderMemberInvitations": "createProviderMemberInvitation",
  "setProviderMemberAccess": "createProviderMemberInvitation",
  "updateProviderMemberRole": "createProviderMemberInvitation",
  "syncProviderOrganizationOwnerAccess": "createProviderMemberInvitation",
  "submitProviderScopedClaim": "submitProviderClaim",
  "getProviderClaimScopeOptions": "submitProviderClaim",
  "providerLocationExpansionOps": "submitProviderClaim",
  "providerLocationIdentityResolutionOps": "submitProviderClaim",
  "providerLocationLifecycleOps": "submitProviderClaim",
  "updateProviderLocation": "submitProviderClaim",
  "getProviderServiceConfiguration": "providerServiceConfigurationOps",
  "getProviderLocationServices": "providerServiceConfigurationOps",
  "copyProviderServiceConfiguration": "providerServiceConfigurationOps",
  "copyProviderOpeningHours": "providerServiceConfigurationOps",
  "saveProviderOperatingHours": "providerServiceConfigurationOps",
  "saveProviderRoutineProfile": "providerServiceConfigurationOps",
  "submitProviderWorkspaceChange": "providerServiceConfigurationOps",
  "manageProviderOrganizationProfile": "providerServiceConfigurationOps",
  "profileFoundationOps": "providerServiceConfigurationOps",
  "locationPhotoOps": "providerServiceConfigurationOps",
  "providerPhotoUploadLifecycleOps": "providerServiceConfigurationOps",
  "preserveLegacyLocationLogo": "providerServiceConfigurationOps",
  "submitProviderLogoForReview": "providerServiceConfigurationOps",
  "manageMyProfessionalProfile": "getMyProfessionalWorkspace",
  "manageProfessionalAssignment": "getMyProfessionalWorkspace",
  "professionalInvitationOps": "getMyProfessionalWorkspace"
};

export function installBase44FunctionRouting(client) {
  const rawFunctions = client.functions;
  const rawInvoke = rawFunctions.invoke.bind(rawFunctions);
  const routedFunctions = new Proxy(rawFunctions, {
    get(target, property, receiver) {
      if (property === 'invoke') {
        return (functionName, payload = {}) => {
          const router = BASE44_FUNCTION_ROUTES[functionName];
          if (!router) return rawInvoke(functionName, payload);
          return rawInvoke(router, { __function: functionName, payload });
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'functions') return routedFunctions;
      return Reflect.get(target, property, receiver);
    },
  });
}
