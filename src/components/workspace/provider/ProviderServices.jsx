import React from "react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";
import "./ProviderServicesClean.css";

export default function ProviderServices(props) {
  return (
    <div className="provider-services-compact">
      <div className="provider-services-polish">
        <ProviderServicesWorkspaceRuntime {...props} />
      </div>
    </div>
  );
}
