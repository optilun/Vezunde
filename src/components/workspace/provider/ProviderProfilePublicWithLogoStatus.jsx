import React from "react";
import ProviderLogoReviewStatus from "./ProviderLogoReviewStatus";
import ProviderProfilePublic from "./ProviderProfilePublic.jsx";

export default function ProviderProfilePublicWithLogoStatus(props) {
  const organizationId = props.overview?.organization?.id
    || props.workspace?.organizations?.[0]?.id
    || props.overview?.location?.organization_id
    || "";

  return (
    <div className="space-y-4">
      <ProviderLogoReviewStatus
        organizationId={organizationId}
        locationId={props.locationId}
      />
      <ProviderProfilePublic {...props} />
    </div>
  );
}
