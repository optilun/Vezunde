import React from "react";
import ProviderServicesWorkspace from "./ProviderServicesWorkspace";
import "./ProviderServicesPolish.css";
import "./ProviderServicesPremiumIcons.css";

export default function ProviderServices(props) {
  return (
    <div className="provider-services-polish">
      <ProviderServicesWorkspace {...props} />
    </div>
  );
}
