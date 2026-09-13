import React from "react";
import ProviderServicesEditor from "./ProviderServicesEditor";
// Faza 4a: un singur strat de styling, impartit in trei fisiere doar din cauza
// limitei de dimensiune. Ordinea importurilor ESTE ordinea cascadei.
import "./ProviderServices.css";
import "./ProviderServicesFlow.css";
import "./ProviderServicesTheme.css";
import "./ProviderServicesEditor.css";

export default function ProviderServices(props) {
  return <ProviderServicesEditor key={props.locationId || props.location?.id} {...props} />;
}