import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('base44/functions/browseDirectoryProviders/entry.ts','utf8').replace(/^import[\s\S]*?;\n/gm,'');
const locations = Array.from({length:55}, (_,i) => ({id:String(i),name:String(i).padStart(2,'0'),public_visibility_status:'approved',provider_profile_type:'ophthalmology_clinic',provider_type:'clinica_oftalmologica',expose_full_details:true}));
locations.push({ ...locations[0], id:'hidden', name:'Hidden', expose_full_details:false });
locations.push({ ...locations[0], id:'suspended', profile_control_status:'suspended' }, { ...locations[0], id:'inactive', active_status:'inactiva' });
locations[54].lat = null; locations[54].lng = null;
const rows = [
  { location_id:'54', service_key:'oct', cas_reimbursed:true },
  { location_id:'53', service_key:'oct', cas_reimbursed:false },
  { location_id:'52', service_key:'consult', cas_reimbursed:true },
  { location_id:'51', service_key:'oct', cas_reimbursed:true, migration_review_required:true },
  { location_id:'50', service_key:'oct', cas_reimbursed:true, eligible:false },
  { location_id:'hidden', service_key:'oct', cas_reimbursed:true },
];
let handler;
const entities = Object.fromEntries(['LocationService','ProfessionalLocationAssignment','LocationEquipment','LocationFacility','ProfessionalProfile'].map(name => [name,{ name, get:async()=>null }]));
vm.runInNewContext(source,{
  Deno:{serve:fn=>handler=fn}, Response,
  createClientFromRequest:()=>({asServiceRole:{entities}}),
  normalizeServiceKey:key=>({definition:['oct','consult'].includes(key)?{}:null,canonicalKey:key}),
  isServicePubliclyEligible:()=>true,
  evaluateServicePrerequisites:(_key,context)=>({eligible:context.location.id!=='50'}),
  getPublicLocationDisclosure:loc=>({...loc,profile_control_status:loc.profile_control_status || 'directory',lat:'lat' in loc ? loc.lat : 1,lng:'lng' in loc ? loc.lng : 1}),
  loadAllPublicLocationsByCounty:async()=>locations,
  loadPublicLocationsForLocality:async()=>locations,
  loadDirectoryDetailOverlay:async()=>({}),
  withDirectoryDetail:loc=>loc,
  loadRowsForLocationIds:async(entity,ids)=>entity.name==='LocationService'?rows.filter(row=>ids.includes(row.location_id)):[],
  paginateRows:(items,{pageSize,offset})=>({page:items.slice(offset,offset+pageSize),pagination:{total:items.length,has_more:offset+pageSize<items.length,next_offset:offset+pageSize}}),
});
const run = async payload => (await handler({json:async()=>({locality_siruta_code:'123',...payload})})).json();
assert.deepEqual((await run({filter_service_keys:['oct'],cas_only:true})).results.map(row=>row.id),['54']);
assert.deepEqual((await run({filter_service_keys:['oct']})).results.map(row=>row.id),['53','54']);
assert.deepEqual((await run({filter_service_keys:['oct','consult'],cas_only:true})).results.map(row=>row.id),['52','54']);
const page=await run({filter_service_keys:['oct','consult'],cas_only:true,limit:1,offset:1});
assert.equal(page.pagination.total,2);
assert.equal(page.results[0].id,'54');
assert.equal((await run({provider_types:['optica_medicala'],cas_only:true})).results.length,0);
assert.ok((await run({filter_service_keys:['unknown']})).error);
const allMap = await run({include_map_results:true, limit:50});
assert.equal(allMap.results.length,50);
assert.equal(allMap.map_results.length,56, 'Map is independent of the first 50 cards');
assert.ok(allMap.map_results.some(row=>row.id==='54' && row.lat === null && row.lng === null), 'Unpositioned locations remain in the list, without invented coordinates');
assert.ok(!allMap.map_results.some(row=>['suspended','inactive'].includes(row.id)), 'Hidden statuses are excluded from map and list');
assert.equal(allMap.map_results.some(row=>'phone' in row),false, 'Lightweight map projection excludes contact fields');
const filteredMap = await run({include_map_results:true,filter_service_keys:['oct','consult'],cas_only:true,limit:1});
assert.equal(filteredMap.results.length,1);
assert.deepEqual(filteredMap.map_results.map(row=>row.id),['52','54']);
assert.equal((await run({limit:1})).map_results,undefined, 'Existing callers keep their original response shape');
console.log('Search filters: CAS tied to selected service; hidden/ineligible/migration rows excluded; OR selections; pagination after filtering; invalid keys rejected — OK');
