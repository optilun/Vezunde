import React from "react";
import ProviderServicesWorkspaceStructured from "./ProviderServicesWorkspaceStructured";
import "./ProviderServicesPolish.css";
import "./ProviderServicesStructured.css";

export default function ProviderServices(props) {
  return (
    <div className="provider-services-polish">
      <ProviderServicesWorkspaceStructured {...props} />
    </div>
  );
}
