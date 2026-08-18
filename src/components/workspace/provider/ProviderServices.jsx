import React from "react";
import ProviderServicesThreeColumn from "./ProviderServicesThreeColumn";
// Faza 4a: un singur strat de styling, impartit in trei fisiere doar din cauza
// limitei de dimensiune. Ordinea importurilor ESTE ordinea cascadei.
import "./ProviderServices.css";
import "./ProviderServicesFlow.css";
import "./ProviderServicesTheme.css";

export default function ProviderServices(props) {
  return <ProviderServicesThreeColumn {...props} />;
}