const ALLOWED=new Set(['earthengine.googleapis.com','earthengine-highvolume.googleapis.com','earthengine.google.com']);
export function normalizeSlopeTemplate(value){if(typeof value!=='string')return '';return value.trim().replace(/^(["'])([\s\S]*)\1$/,'$2').replace(/%7B([xyz])%7D/gi,(_,key)=>'{'+key.toLowerCase()+'}');}
export function validSlopeTemplate(value){if(!value||!['{x}','{y}','{z}'].every(k=>value.includes(k)))return false;try{const u=new URL(value);return u.protocol==='https:'&&ALLOWED.has(u.hostname)&&!u.username&&!u.password&&(!u.port||u.port==='443');}catch{return false;}}
export function validTile(z,x,y){return [z,x,y].every(Number.isInteger)&&z>=0&&z<=19&&x>=0&&y>=0&&x<2**z&&y<2**z;}
export default async function handler(req,res){
 const params=new URL(req.url,'http://localhost').searchParams,template=normalizeSlopeTemplate(process.env.SLOPE_TILE_URL),configured=validSlopeTemplate(template);
 const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
 const mode=params.get('mode');
 if(mode!=='tile'&&mode!=='dem')return json(200,{available:configured,state:configured?'configured':template?'invalid_template':'missing_variable'});
 if(mode==='tile'&&!configured)return json(503,{error:'Layer kemiringan belum terhubung.'});
 const raw=['z','x','y'].map(k=>params.get(k));if(raw.some(v=>v===null||!/^\d+$/.test(v)))return json(400,{error:'Tile tidak valid.'});const [z,x,y]=raw.map(Number);if(!validTile(z,x,y))return json(400,{error:'Tile tidak valid.'});
 if(mode==='dem'&&z>12)return json(400,{error:'Zoom elevasi tidak valid.'});
 const url=mode==='dem'?`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`:template.replaceAll('{z}',String(z)).replaceAll('{x}',String(x)).replaceAll('{y}',String(y));
 try{const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'image/png,image/*'}});if(!response.ok)return json(502,{error:mode==='dem'?'Tile elevasi cadangan belum tersedia.':[401,403,404].includes(response.status)?'Akses layer Earth Engine perlu diperbarui.':'Gambar layer belum dapat dimuat.'});if(!response.headers.get('content-type')?.startsWith('image/'))return json(502,{error:'Sumber belum mengembalikan gambar layer.'});res.statusCode=200;res.setHeader('Content-Type',response.headers.get('content-type'));res.setHeader('Cache-Control',mode==='dem'?'public,max-age=86400,s-maxage=604800':'public,max-age=300');res.end(Buffer.from(await response.arrayBuffer()));}catch{return json(502,{error:mode==='dem'?'Sumber elevasi cadangan belum dapat dijangkau.':'Layer Earth Engine belum dapat dijangkau.'});}
}
