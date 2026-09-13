import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { getEditorStatus, reviewFingerprint, selectionChanges, saveBeforeContinuing } from "../src/components/workspace/provider/services/servicesEditorModel.js";

assert.equal(getEditorStatus({approvedCount:21,hasDraft:false,hasChanges:false}).title,"Oferta este la zi");
assert.equal(getEditorStatus({approvedCount:21,hasDraft:true,hasChanges:false}).title,"Oferta este la zi");
assert.equal(getEditorStatus({approvedCount:21,hasDraft:true,hasChanges:true}).title,"Modificările sunt salvate");
assert.equal(getEditorStatus({pendingReview:true,hasDraft:true,hasChanges:true}).tone,"pending");
assert.equal(getEditorStatus({pendingReview:true,dirty:true}).tone,"warning");
assert.equal(getEditorStatus({error:"offline",hasDraft:true,hasChanges:true}).tone,"error");
assert.equal(reviewFingerprint(["a","b"]), reviewFingerprint(["b","a"]));
assert.notEqual(reviewFingerprint(["a"]), reviewFingerprint(["a","b"]));
assert.deepEqual(selectionChanges(["a","b"],["b","c"]).map(row=>[row.key,row.kind]),[["c","added"],["a","removed"]]);
let progressed=0;
assert.equal(await saveBeforeContinuing({dirty:true,save:async()=>false,onSuccess:()=>progressed++}),false);
assert.equal(await saveBeforeContinuing({dirty:true,save:async()=>{throw Error("offline")},onSuccess:()=>progressed++}),false);
assert.equal(progressed,0);
await saveBeforeContinuing({dirty:false,save:()=>{throw Error("must not save unchanged data")},onSuccess:()=>progressed++});
assert.equal(progressed,1);

for (const name of ["directoryFunctionRouting.js", "serviceConfigurationFunctionRouting.js", "providerWorkspaceFunctionRouting.js"]) {
  assert.equal(await readFile("shared/" + name, "utf8"), await readFile("base44/shared/" + name, "utf8"), "Frontend and backend routing must remain identical: " + name);
}

const temp = await mkdtemp(path.join(tmpdir(),"viasee-services-test-"));
try {
  const reactFile=path.join(temp,"react.mjs");
  const apiFile=path.join(temp,"api.mjs");
  await writeFile(reactFile, `
let slots=[],cursor=0,effects=[];
const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
export function begin(){cursor=0;}
export function flush(){const pending=effects;effects=[];for(const run of pending)run();}
export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==="function"?initial():initial;return [slots[i],value=>{slots[i]=typeof value==="function"?value(slots[i]):value;}];}
export function useRef(initial){const [ref]=useState(()=>({current:initial}));return ref;}
export function useMemo(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;}
export function useEffect(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i],deps)){slots[i]=deps;effects.push(fn);}}
export default {useState,useMemo,useRef,useEffect};
`);
  await writeFile(apiFile,`export const base44={functions:{invoke:(name,payload)=>globalThis.__servicesMock(name,payload)}};`);
  const entry=path.join(temp,"entry.mjs");
  await writeFile(entry,`export {useProviderServicesConfig} from ${JSON.stringify(path.resolve("src/components/workspace/provider/services/useProviderServicesConfig.js"))}; export {begin,flush} from ${JSON.stringify(reactFile)};`);
  const output=path.join(temp,"bundle.mjs");
  await build({entryPoints:[entry],outfile:output,bundle:true,platform:"node",format:"esm",logLevel:"silent",
    alias:{"react":reactFile,"@/api/base44Client":apiFile,"@":path.resolve("src")}});
  let submission=null,failSave=false,writeCount=0;
  const config={service_keys:[],functional_units:[{unit_key:"optical_store",is_active:true}],capabilities:[],service_unit_map:{},cas_service_keys:[],can_edit_services:true,assignments:[],equipment:[],facilities:[],care_setting:"not_applicable"};
  globalThis.__servicesMock=async(name,payload)=>{
    if(name==="getServiceSearchCatalog")return {data:{}};
    if(name==="getProviderServiceConfiguration")return {data:structuredClone(config)};
    if(payload.action==="list_mine")return {data:{submissions:submission?[submission]:[],conflicts:[]}};
    writeCount++;
    if(failSave)return {data:{error:"Simulated offline save"}};
    submission={id:"test-draft",section:"services",status:"draft",payload_json:JSON.stringify(payload.payload)};
    return {data:{submission}};
  };
  const harness=await import(pathToFileURL(output).href);
  const props={locationId:"test-location",location:{id:"test-location",provider_profile_type:"optical_store",provider_type:"optica"}};
  let model;
  async function render(){harness.begin();model=harness.useProviderServicesConfig(props);harness.flush();await new Promise(resolve=>setImmediate(resolve));return model;}
  for(let i=0;i<5;i++)await render();
  assert.equal(model.loading,false);
  const item=model.profileSections.flatMap(section=>section.items).find(item=>item.group!=="business_attributes");
  assert.ok(item,"catalog must contain a real service");
  model.toggleService(item,"optical_store");
  await render();
  assert.equal(model.dirty,true);
  failSave=true;
  assert.equal(await model.save(),false);
  await render();
  assert.equal(model.dirty,true,"failed save keeps changes unsaved");
  assert.ok(model.selected[item.group].includes(item.id),"failed save keeps selected service");
  failSave=false;
  assert.equal(await model.save(),true);
  await render();
  assert.equal(model.dirty,false,"successful save establishes new baseline");
  assert.equal(model.message,"Modificările au fost salvate.");
  assert.equal(model.draft.id,"test-draft");
  assert.ok(JSON.parse(submission.payload_json).selected_ids[item.group].includes(item.id));
  const priorWrites=writeCount;
  assert.equal(await model.save(),true);
  assert.equal(writeCount,priorWrites,"continuing unchanged must not create another draft");
  await model.load();
  for(let i=0;i<3;i++)await render();
  assert.ok(model.selected[item.group].includes(item.id),"saved choice survives reload");
  assert.equal(model.dirty,false);
  console.log("Services editor: status, review progress, save failure, successful save, unchanged continue and reload PASS");
} finally {
  delete globalThis.__servicesMock;
  await rm(temp,{recursive:true,force:true});
}
