import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
const temp=await mkdtemp(path.join(tmpdir(),"viasee-hours-editor-"));
try {
const reactFile=path.join(temp,"react.mjs");
await writeFile(reactFile,`
let slots=[],cursor=0,effects=[];
const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
export function begin(){cursor=0;} export function flush(){const jobs=effects;effects=[];jobs.forEach(fn=>fn());}
export function reset(){slots=[];cursor=0;effects=[];}
export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==="function"?initial():initial;return [slots[i],v=>slots[i]=typeof v==="function"?v(slots[i]):v];}
export function useRef(initial){const [ref]=useState(()=>({current:initial}));return ref;}
export function useMemo(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;}
export function useEffect(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i],deps)){slots[i]=deps;effects.push(fn);}}
export const createElement=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)});
export default {useState,useRef,useMemo,useEffect,createElement};
`);
const apiFile=path.join(temp,"api.mjs");
await writeFile(apiFile,'export const base44={functions:{invoke:(name,payload)=>globalThis.__hoursEditorMock(name,payload)}};');
const iconsFile=path.join(temp,"icons.mjs");
await writeFile(iconsFile,'export const ArrowLeft=()=>null,ArrowRight=()=>null,Plus=()=>null,Save=()=>null,Trash2=()=>null;');
const entry=path.join(temp,"entry.mjs"), output=path.join(temp,"bundle.mjs");
await writeFile(entry,`export {default as Editor} from ${JSON.stringify(path.resolve("src/components/workspace/provider/ProviderHours.jsx"))};export {begin,flush,reset} from ${JSON.stringify(reactFile)};`);
await build({entryPoints:[entry],outfile:output,bundle:true,platform:"node",format:"esm",jsx:"transform",loader:{".css":"empty"},logLevel:"silent",alias:{react:reactFile,"lucide-react":iconsFile,"@/api/base44Client":apiFile,"@":path.resolve("src")}});
globalThis.window={addEventListener(){},removeEventListener(){}};
const h=await import(pathToFileURL(output).href);
const weekly=Object.fromEntries(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(key=>[key,{open:key!=="sunday",from:key==="sunday"?"":"09:00",to:key==="sunday"?"":key==="saturday"?"14:00":"18:00"}]));
let dirty=null,calls=[],result={data:{success:true}},resolveSave;
globalThis.__hoursEditorMock=async(name,payload)=>{calls.push({name,payload});return resolveSave ? await new Promise(resolve=>resolveSave=resolve) : result;};
const props={locationId:"test",location:{opening_hours_json:JSON.stringify({weekly,exceptions:[]}),availability_status:"necunoscuta"},onDirtyChange:value=>dirty=value};
let tree;
function render(){h.begin();tree=h.Editor(props);h.flush();return tree;}
function all(node){return !node||typeof node!=="object"?[]:[node,...(node.children||[]).flatMap(all)];}
function text(node){return typeof node==="string"?node:!node||typeof node!=="object"?"":(node.children||[]).map(text).join("");}
function button(label){return all(tree).find(node=>node.type==="button"&&text(node).trim()===label);}
function field(label){return all(tree).find(node=>node.props.label===label);}
function steps(){return all(tree).find(node=>node.props.label==="Configurarea programului");}
render();assert.equal(dirty,false);
field("Deschidere Luni").props.onChange("10:00");render();
button("Copiază luni în marți–vineri").props.onClick();render();
assert.equal(field("Deschidere Marți").props.value,"10:00");
assert.equal(field("Închidere Sâmbătă").props.value,"14:00","weekday copying must preserve Saturday");
assert.equal(field("Deschidere Duminică").props.disabled,true);
steps().props.onChange("review");render();
field("Închidere Luni").props.onChange("08:00");render();
await button("Salvează programul").props.onClick();render();
assert.equal(calls.length,0,"invalid hours must not reach the backend");
assert.ok(all(tree).find(node=>node.props.role==="alert"));
field("Închidere Luni").props.onChange("18:00");render();
result={data:{error:"offline"}};await button("Salvează programul").props.onClick();render();
assert.equal(dirty,true);assert.equal(field("Deschidere Luni").props.value,"10:00");
result={data:{}};await button("Salvează programul").props.onClick();render();
assert.equal(dirty,true,"an empty response must not establish a saved baseline");
result={data:{success:true}};await button("Salvează programul").props.onClick();render();
assert.equal(dirty,false);assert.equal(button("Salvează programul").props.disabled,true);
const payload=calls.at(-1).payload;assert.equal(JSON.parse(payload.opening_hours_json).weekly.saturday.to,"14:00");
field("Deschidere Luni").props.onChange("11:00");render();
resolveSave=true;const save=button("Salvează programul").props.onClick();const count=calls.length;
await button("Salvează programul").props.onClick();assert.equal(calls.length,count,"in-flight save must not be duplicated");
resolveSave({data:{success:true}});await save;render();assert.equal(dirty,false);
console.log("Hours editor behavior: weekday copy, local validation, failure/retry, acknowledgment and concurrent-save lock PASS");
} finally {delete globalThis.__hoursEditorMock;delete globalThis.window;await rm(temp,{recursive:true,force:true});}
