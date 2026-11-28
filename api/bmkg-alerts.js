import {XMLParser, XMLValidator} from 'fast-xml-parser';

const feed = 'https://www.bmkg.go.id/alerts/nowcast/id';
const documentUrl = /^https:\/\/www\.bmkg\.go\.id\/alerts\/nowcast\/id\/[\w-]+_alert\.xml$/;
const parser = new XMLParser({parseTagValue:false, removeNSPrefix:true, processEntities:false});
const array = value => value == null ? [] : [value].flat();
const severity = {Extreme:4, Severe:3, Moderate:2, Minor:1};

async function xml(url) {
 const response = await fetch(url,{signal:AbortSignal.timeout(5500),redirect:'error'});
 if (!response.ok) throw Error('HTTP '+response.status);
 const body = await response.text();
 if (body.length > 2_000_000 || /<!DOCTYPE/i.test(body) || XMLValidator.validate(body)!==true) throw Error('XML tidak valid');
 return parser.parse(body);
}

function polygons(areas) {
 return areas.flatMap(area => array(area.polygon)).flatMap(value => {
  const points = String(value).trim().split(/\s+/).map(pair => pair.split(',').map(Number));
  return points.length>=4 && points.every(([lat,lng,...rest]) =>
   !rest.length && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180) ? [points] : [];
 });
}

export async function loadAlerts(now = Date.now()) {
 const channel = (await xml(feed)).rss?.channel;
 if (!channel) throw Error('RSS tidak valid');
 const all = [...new Set(array(channel.item).map(item => item.link).filter(link => documentUrl.test(link)))];
 const links = all.slice(0,72);
 const settled = [];
 for (let offset=0;offset<links.length;offset+=18) {
  settled.push(...await Promise.allSettled(links.slice(offset,offset+18).map(async link => {
   const {alert} = await xml(link);
   if (!alert?.identifier) throw Error('CAP tidak valid');
   return {alert,link};
  })));
 }
 const docs = settled.filter(result=>result.status==='fulfilled').map(result=>result.value)
  .filter(({alert})=>alert.status==='Actual' && alert.scope==='Public');
 if (settled.length && settled.every(result=>result.status==='rejected')) throw Error('CAP tidak dapat dimuat');
 const superseded = new Set(docs.filter(({alert})=>['Cancel','Update'].includes(alert.msgType))
  .flatMap(({alert})=>String(alert.references||'').split(/\s+/).map(ref=>ref.split(',')[1]).filter(Boolean)));
 const items = docs.flatMap(({alert,link})=>{
  if (!['Alert','Update'].includes(alert.msgType) || superseded.has(alert.identifier)) return [];
  const infos = array(alert.info);
  const info = infos.find(item=>/^id(?:-|$)/i.test(item.language||'')) || infos[0];
  if (!info) return [];
  const start = Date.parse(info.onset||info.effective||alert.sent), end = Date.parse(info.expires);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end<=now || end<=start) return [];
  const areas = array(info.area);
  return [{id:alert.identifier,title:info.headline||info.event||'Peringatan dini cuaca',
   description:info.description||'',instruction:info.instruction||'',start,end,
   level:info.severity||'Unknown',rank:severity[info.severity]||0,
   region:areas.map(area=>area.areaDesc).filter(Boolean).join(' · '),polygons:polygons(areas),link}];
 });
 items.sort((a,b)=>b.rank-a.rank||a.end-b.end);
 return {checkedAt:new Date(now).toISOString(),incomplete:all.length!==links.length||settled.some(r=>r.status==='rejected'),items};
}

export default async function handler(req,res) {
 try {
  const data = await loadAlerts();
  res.setHeader('Cache-Control','s-maxage=60');
  res.status(200).json(data);
 } catch {
  res.setHeader('Cache-Control','no-store');
  res.status(502).json({error:'Sumber peringatan BMKG belum dapat dihubungi.'});
 }
}
