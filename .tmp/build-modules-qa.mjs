import {build} from "esbuild";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const dir="/tmp/viasee-modules-qa"; await mkdir(dir,{recursive:true});
await writeFile(dir+"/api.js",`
export const state={fail:false,missingAck:false,writes:0,uploads:0,submits:0,invites:0,photo:null};
let invitations=[{id:"expired-demo",status:"expired",professional_type:"oftalmolog",invited_email_masked:"demo***@example.com",expires_at:"2026-01-01"}];
let assignments=[
{id:"p1",professional_id:"p1",full_name:"Specialist demonstrativ",professional_type:"optometrist",active_status:"activ",public_status:"privat",visibility_consent_status:"pending",verification_status:"verified"},
{id:"p2",professional_id:"p2",full_name:"Medic demonstrativ",professional_type:"oftalmolog",active_status:"activ",public_status:"privat",visibility_consent_status:"none",verification_status:"verified",can_publish:true},
{id:"p3",professional_id:"p3",full_name:"Optician demonstrativ",professional_type:"optician",is_association_request:true,association_requested_at:"2026-10-01",active_status:"inactiv"}
];
export const base44={functions:{invoke:async(name,payload)=>{
await new Promise(resolve=>setTimeout(resolve,220));
const read=payload.action==="get"||payload.action==="list"||name==="getPublicProviderContent";
if(state.fail)return {data:{error:"Eroare simulată pentru verificare. Încearcă din nou."}};
if(!read)state.writes++;
if(name==="saveProviderRoutineProfile")return {data:state.missingAck?{}:{success:true,updates:payload}};
if(name==="getPublicProviderContent")return {data:{team:[]}};
if(name==="professionalInvitationOps"){
 if(payload.action==="list")return {data:{invitations}};
 if(payload.action==="create"){state.invites++;invitations=[...invitations,{id:"demo-invite",status:"pending",professional_type:payload.professional_type,invited_email_masked:"demo***@example.com"}];return {data:{invitation_link:"https://example.com/invitatie-demo",email_sent:true}};}
 if(payload.action==="resend")return {data:{invitation_link:"https://example.com/invitatie-demo",email_sent:true}};
 return {data:{success:true}};
}
if(name==="manageProfessionalAssignment"){
 if(payload.action==="list")return {data:{assignments,current_user_professional:null}};
 return {data:{success:true}};
}
if(name==="locationPhotoOps"){
 if(payload.action==="get")return {data:{location:{current_photo_url:"/images/specialists/optical-team-hero-v1.webp"},submission:state.photo}};
 if(payload.action==="save_draft"){state.photo={id:"demo-photo",status:"draft",payload:payload.photo};return {data:{submission:state.photo}};}
 if(payload.action==="submit_review"){state.submits++;state.photo={...state.photo,status:"pending_review"};return {data:{success:true,submission:state.photo}};}
}
if(name==="providerPhotoUploadLifecycleOps"){
 if(payload.action==="register_upload")return {data:{asset:{id:"demo-asset"}}};
 if(payload.action==="discard_draft")state.photo=null;
 return {data:{success:true}};
}
return {data:{success:true}};
}},integrations:{Core:{UploadFile:async()=>{state.uploads++;return {file_url:"/images/specialists/optical-team-hero-v1.webp"};}}}};
`);
await writeFile(dir+"/locations.jsx",`
import React from "react";
export const CONFIGURE_TONES={fotografie:{border:"#deded8",bg:"#faf9f5"}};
export default function Locations(){return <><h1 className="text-xl font-bold mb-6">Locație demonstrativă</h1><section><h2 className="text-lg font-bold mb-4">Configurează locația</h2><div className="grid gap-3"><button>Servicii</button><button>Program</button><button>Specialiști</button></div></section></>;}
`);
await writeFile(dir+"/entry.jsx",`
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import ProviderLocationModulePage from "@/components/workspace/provider/ProviderLocationModulePage";
import ProviderLocationsWithPhoto from "@/components/workspace/provider/ProviderLocationsWithPhoto";
import {state} from "./api.js";
const weekly={monday:{open:true,from:"09:00",to:"18:00"},tuesday:{open:true,from:"09:00",to:"18:00"},wednesday:{open:true,from:"09:00",to:"18:00"},thursday:{open:true,from:"09:00",to:"18:00"},friday:{open:true,from:"09:00",to:"18:00"},saturday:{open:true,from:"09:00",to:"14:00"},sunday:{open:false,from:"",to:""}};
const location={id:"demo-location",name:"Locație demonstrativă",locality:"Giroc",county:"Timiș",organization_id:"demo-org",active_status:"inactiva",opening_hours_json:JSON.stringify({weekly,exceptions:[]}),availability_status:"necunoscuta",capabilities:["location.manage_content","location.manage_operational_status","location.manage_specialists"]};
function App(){
const [module,setModule]=useState("program"); const [,refresh]=useState(0);
const [fail,setFail]=useState(false);const [missing,setMissing]=useState(false);
return <BrowserRouter><header className="qa-header"><img src="/images/viasee-logo.svg" alt="VIASEE" onError={e=>e.currentTarget.style.display="none"}/><strong>PREVIZUALIZARE DE TEST · DATE DEMONSTRATIVE</strong>
<nav>{["program","specialisti","foto"].map(key=><button key={key} onClick={()=>setModule(key)}>{key==="program"?"Program":key==="specialisti"?"Specialiști":"Foto"}</button>)}</nav>
<label><input type="checkbox" checked={fail} onChange={e=>{state.fail=e.target.checked;setFail(e.target.checked);}}/> Simulează eroare</label>
<button onClick={async()=>{const blob=await (await fetch("/images/specialists/optical-team-hero-v1.webp")).blob();const file=new File([blob],"fotografie-demonstrativa.webp",{type:"image/webp"});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('input[type="file"]');input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));}}>Selectează imagine demonstrativă</button>
<label><input type="checkbox" checked={missing} onChange={e=>{state.missingAck=e.target.checked;setMissing(e.target.checked);}}/> Răspuns fără confirmare</label>
</header><main key={module}>
{module==="foto"?<ProviderLocationsWithPhoto workspace={{locations:[location],current_user_capabilities:location.capabilities}} selectedLocationId="demo-location" onRefresh={()=>refresh(x=>x+1)}/>
:<ProviderLocationModulePage workspace={{locations:[location]}} locationId="demo-location" moduleKey={module} onRefresh={()=>refresh(x=>x+1)}/>}
</main><output className="qa-counts">Operații mock: {state.writes} · Încărcări: {state.uploads} · Trimiteri foto: {state.submits} · Invitații: {state.invites}</output></BrowserRouter>;
}
createRoot(document.getElementById("root")).render(<App/>);
`);
await build({entryPoints:[dir+"/entry.jsx"],outfile:"public/__qa-modules.js",bundle:true,format:"esm",platform:"browser",jsx:"automatic",plugins:[{name:"mock-location-list",setup(api){api.onResolve({filter:/^\\.\\/ProviderLocations$/},args=>args.importer.endsWith("ProviderLocationsWithPhoto.jsx")?{path:dir+"/locations.jsx"}:undefined);}}],external:["/images/*"],alias:{"@/api/base44Client":dir+"/api.js","@":path.resolve("src"),react:path.resolve("node_modules/react"),"react-dom":path.resolve("node_modules/react-dom"),"react-router-dom":path.resolve("node_modules/react-router-dom")},define:{"process.env.NODE_ENV":'"development"'}});
await writeFile("public/__qa-modules.html",`<!doctype html><html lang="ro"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css?direct"><link rel="stylesheet" href="/__qa-modules.css"><style>body{background:#faf9f5}.qa-header{padding:14px 22px;border-bottom:1px solid #deded8;background:white;display:flex;gap:15px;align-items:center;flex-wrap:wrap;font-size:11px}.qa-header img{width:90px}.qa-header nav{display:flex;gap:10px}.qa-header button{font-size:13px;border:1px solid #deded8;border-radius:6px;padding:8px 12px}main{padding:24px;max-width:1170px;margin:auto}.qa-counts{display:block;font-size:11px;color:#777;text-align:center;margin:20px}@media(max-width:600px){main{padding:16px}.qa-header{padding:10px;gap:10px}}</style><div id="root"></div><script type="module" src="/__qa-modules.js"></script></html>`);
