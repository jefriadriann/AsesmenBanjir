export function maximum(values) {
 const known=values.filter(Number.isInteger);
 return known.length?Math.max(...known):null;
}
export function mapValues(district,basis,mode,matrix) {
 const classes=district[basis];
 if (mode==='potensi') return classes;
 if (mode==='pemicu') return district.triggers;
 return classes.map((value,i)=>matrix[value]?.[district.triggers[i]]??null);
}
export function filterMonitoring(detail,filters,raster) {
 const {basis,province,district,hazard,sampling}=filters;
 const areas=detail.districts.filter(d=>(!province||d.province===province)&&(!district||d.id===district));
 const byId=new Map(areas.map(d=>[d.id,d]));
 const rows=[];
 const all=hazard==='';
 for (const office of detail.offices) {
  const area=byId.get(office.district);
  if (!area && (province||district)) continue;
  const unknown=detail.hazards.map(()=>null);
  const warning=area?mapValues(area,basis,'status',detail.matrix):unknown;
  const regional=area?.[basis]??unknown;
  const classes=sampling==='raster'?(raster?.rows[office.id]??unknown):regional;
  const relevant=all?classes:[classes[hazard]];
  const max=maximum(relevant);
  rows.push({...office,area,classes,warning,level:all?maximum(warning):warning[hazard],
   potential:all?maximum(regional):regional[hazard],high:relevant.filter(c=>c===3).length,
   complete:relevant.every(Number.isInteger),hasHigh:max===3,score:area?.scores[basis==='baseline'?0:1]??0});
 }
 rows.sort((a,b)=>(b.level??-1)-(a.level??-1)||b.score-a.score||a.name.localeCompare(b.name,'id'));
 const statusCounts=[0,1,2,3,null].map(s=>rows.filter(row=>row.level===s).length);
 const hazards=detail.hazards.map((h,i)=>({...h,index:i,
  counts:[3,2,1,0,null].map(c=>rows.filter(r=>r.classes[i]===c).length),
  alerts:rows.filter(r=>r.warning[i]>=1).length})).filter(h=>all||h.index===Number(hazard));
 return {areas,rows,statusCounts,hazards,attention:rows.filter(r=>r.level>=1),high:rows.filter(r=>r.hasHigh).length,
  complete:rows.filter(r=>r.complete).length,measured:rows.some(r=>(all?r.classes:[r.classes[hazard]]).some(Number.isInteger))};
}
