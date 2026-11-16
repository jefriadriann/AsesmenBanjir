// Fixed official source proxy: no arbitrary URL forwarding or credentials.
const ROOT='https://inarisk.bnpb.go.id/arcgis/rest/services';
const validService=s=>typeof s==='string'&&s.length<220&&/^[a-zA-Z0-9_ /-]+\/(MapServer|ImageServer)$/.test(s)&&/banjir|flood/i.test(s)&&!s.includes('..');
async function remote(url,binary=false){const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:binary?'image/png':'application/json','User-Agent':'RuangRisiko-Map/1.0'}});if(!response.ok)throw Error(`Sumber InaRISK merespons HTTP ${response.status}`);if(binary){if(!response.headers.get('content-type')?.startsWith('image/'))throw Error('Layanan belum mengembalikan gambar peta.');return Buffer.from(await response.arrayBuffer());}const body=await response.json();if(body.error)throw Error(body.error.message||'Layanan InaRISK tidak tersedia.');return body;}
export async function handleInarisk(params){
 const mode=params.get('mode')||'catalog';
 if(mode==='catalog'){
  const root=await remote(ROOT+'?f=pjson');const services=[...(root.services||[])];const folders=(root.folders||[]).filter(f=>/^[\w -]+$/.test(f)).slice(0,12);const groups=await Promise.allSettled(folders.map(f=>remote(ROOT+'/'+encodeURIComponent(f)+'?f=pjson')));for(const g of groups)if(g.status==='fulfilled')services.push(...g.value.services||[]);
  const selected=services.filter(s=>['MapServer','ImageServer'].includes(s.type)&&/banjir|flood/i.test(s.name)).map(s=>({name:s.name,type:s.type,service:s.name+'/'+s.type,kind:/risiko|risk/i.test(s.name.split('/').at(-1))?'Risiko banjir':/bahaya|hazard/i.test(s.name.split('/').at(-1))?'Bahaya banjir':'Layer banjir',sourceUrl:ROOT+'/'+s.name+'/'+s.type}));return {json:{services:selected,source:'BNPB InaRISK',retrievedAt:new Date().toISOString()}};
 }
 const service=params.get('service');if(!validService(service))return {status:400,json:{error:'Layanan banjir tidak valid.'}};
 const url=ROOT+'/'+service.split('/').map(encodeURIComponent).join('/');
 if(mode==='metadata'){const meta=await remote(url+'?f=pjson');let legend=null;try{legend=await remote(url+'/legend?f=pjson');}catch{}return {json:{metadata:{name:meta.name||meta.mapName||service,description:meta.serviceDescription||meta.description||'',copyrightText:meta.copyrightText||'',timeInfo:meta.timeInfo||null,sourceUrl:url},legend}};}
 if(mode==='image'){
  const bbox=params.get('bbox');if(!bbox||bbox.split(',').length!==4||!bbox.split(',').every(n=>n.trim()!==''&&Number.isFinite(Number(n))&&Math.abs(Number(n))<=21000000))return {status:400,json:{error:'Batas peta tidak valid.'}};
  const endpoint=service.endsWith('ImageServer')?'exportImage':'export';const query=new URLSearchParams({bbox,bboxSR:'3857',imageSR:'3857',size:'256,256',format:'png32',transparent:'true',f:'image'});return {binary:await remote(url+'/'+endpoint+'?'+query,true)};
 }
 return {status:400,json:{error:'Mode tidak tersedia.'}};
}
export default async function handler(req,res){try{const result=await handleInarisk(new URL(req.url,'http://localhost').searchParams);res.statusCode=result.status||200;if(result.binary){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public, max-age=900');res.end(result.binary);}else{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','public, max-age=300');res.end(JSON.stringify(result.json));}}catch(error){res.statusCode=502;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:error.name==='TimeoutError'?'Sumber InaRISK belum merespons.':error.message,source:'BNPB InaRISK'}));}}
