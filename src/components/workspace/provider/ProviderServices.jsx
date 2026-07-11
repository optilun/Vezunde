import React from "react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";
import "./ProviderServicesPolish.css";
import "./ProviderServicesStructured.css";

export default function ProviderServices(props) {
  return (
    <div className="provider-services-polish">
      <ProviderServicesWorkspaceRuntime {...props} />
    </div>
  );
}
