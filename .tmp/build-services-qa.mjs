import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
await mkdir("/tmp/viasee-services-qa",{recursive:true});
await writeFile("/tmp/viasee-services-qa/api.js", `
import { PROVIDER_SERVICE_SECTIONS } from "/app/src/lib/providerServiceWorkspaceSections.js";
const params = new URLSearchParams(window.location.search);
const fresh = params.get("scenario") === "new";
const pending = params.get("scenario") === "pending";
const readOnly = params.get("scenario") === "readonly";
const keys = [...new Set(PROVIDER_SERVICE_SECTIONS.filter(x=>x.key!=="business_attributes").flatMap(x=>x.items).slice(0,21).map(x=>x.id))];
const config={service_keys:fresh?[]:keys,functional_units:[{unit_key:"optical_store",is_active:true},{unit_key:"optometric_office",is_active:true},{unit_key:"optical_workshop",is_active:true},{unit_key:"ophthalmology_office",is_active:true}],capabilities:[],service_unit_map:{},cas_service_keys:[],can_edit_services:!readOnly,assignments:[],equipment:[],facilities:[],care_setting:"commercial"};
let submission=pending?{id:"qa-draft",section:"services",status:"pending_review",payload_json:JSON.stringify({selected_ids:{},functional_units:config.functional_units}),submitted_payload_json:JSON.stringify({selected_ids:{},functional_units:config.functional_units})}:null;
let writes=0, creates=0, submits=0;
const report = () => { const el=document.getElementById("qa-events");if(el) el.textContent=JSON.stringify({writes,creates,submits,lastAction:window.qaLastAction||""}); };
export const base44={functions:{invoke:async(name,payload)=>{
 if(name==="getServiceSearchCatalog")return {data:{}};
 if(name==="getProviderServiceConfiguration")return {data:structuredClone(config)};
 if(payload.action==="list_mine")return {data:{submissions:submission?[submission]:[],conflicts:[]}};
 await new Promise(r=>setTimeout(r,500));
 window.qaLastAction=payload.action;
 if(document.getElementById("qa-offline")?.checked){report();return {data:{error:"Conexiunea de test este indisponibilă. Selecțiile rămân în formular."}};}
 if(payload.action==="submit"){submits++;submission={...submission,status:"pending_review",submitted_payload_json:submission.payload_json};report();return {data:{submission}};}
 if(payload.action==="withdraw"){submission={...submission,status:"draft"};report();return {data:{submission}};}
 writes++;if(payload.action==="create_draft")creates++;
 submission={id:"qa-draft",section:"services",status:submission?.status||"draft",payload_json:JSON.stringify(payload.payload)};
 report();return {data:{submission}};
}}};
`);
await writeFile("/tmp/viasee-services-qa/entry.jsx", `
import React from "react";
import { createRoot } from "react-dom/client";
import ProviderServices from "/app/src/components/workspace/provider/ProviderServices.jsx";
createRoot(document.getElementById("root")).render(<div className="workspace-neutral qa-shell"><header><p className="qa-tag">PREVIZUALIZARE DE TEST · DATE DEMONSTRATIVE</p><h1>Serviciile locației</h1><p>Locație demonstrativă · Giroc, Timiș</p></header><ProviderServices locationId="qa-location" location={{id:"qa-location",provider_profile_type:"optical_store",provider_type:"optica"}} /></div>);
`);
await build({entryPoints:["/tmp/viasee-services-qa/entry.jsx"],outfile:"public/__qa-services.js",bundle:true,format:"esm",platform:"browser",jsx:"automatic",alias:{"@/api/base44Client":"/tmp/viasee-services-qa/api.js","@":path.resolve("src"),"react":path.resolve("node_modules/react"),"react-dom":path.resolve("node_modules/react-dom")},define:{"process.env.NODE_ENV":'"development"'},logLevel:"silent"});
await writeFile("public/__qa-services.html", `<!doctype html><html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Servicii VIASEE — previzualizare de test</title><link rel="stylesheet" href="/src/index.css?direct"><link rel="stylesheet" href="/__qa-services.css"><style>body{margin:0;background:#faf9f5;font-family:Arial,sans-serif;color:#191a17}.qa-shell{max-width:1200px;margin:auto;padding:30px 40px 120px}.qa-shell>header{margin-bottom:26px;border-bottom:1px solid #ddd;padding-bottom:22px}.qa-shell>header h1{font-size:30px;letter-spacing:-1px;font-weight:700;margin:12px 0 8px}.qa-shell>header p{color:#676c65;font-size:13px;margin:8px 0}.qa-shell .qa-tag{font-size:10px;letter-spacing:1.4px;color:#6877a3}.qa-controls{max-width:1120px;margin:0 auto;padding:12px;font-size:11px;color:#666;border-top:1px solid #ddd}.qa-controls input{width:16px;height:16px;margin-right:7px}@media(max-width:580px){.qa-shell{padding:18px 16px 120px}.qa-shell>header h1{font-size:26px}.qa-controls{margin:0 16px}}</style></head><body><div id="root"></div><div class="qa-controls"><label><input id="qa-offline" type="checkbox">Simulează eroare de salvare (doar test)</label><p id="qa-events">Nicio scriere efectuată</p></div><script type="module" src="/__qa-services.js"></script></body></html>`);
console.log("QA fixture built: actual services component and hook, all APIs replaced with isolated in-memory mock");
