import React from "react";
import ProviderServicesWorkspaceOperational from "./ProviderServicesWorkspaceOperational";
import "./ProviderServicesPolish.css";
import "./ProviderServicesStructured.css";

export default function ProviderServices(props) {
  return (
    <div className="provider-services-polish">
      <ProviderServicesWorkspaceOperational {...props} />
    </div>
  );
}
