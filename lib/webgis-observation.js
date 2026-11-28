// Capture the same public district inputs the dashboard passes to its evaluation engine.
export function observeDistricts() {
 document.addEventListener('DOMContentLoaded',()=>{
  const engine=window.HidrometEWS;
  if (!engine?.evaluate) return;
  const evaluate=engine.evaluate;
  const inputs=new Map();
  engine.evaluate=function(district,weather,basis) {
   inputs.set(district.p+'|'+district.k,{district,weather});
   return evaluate(district,weather,basis);
  };
  window.readMonitoringDistricts=()=>Array.from(inputs,([id,{district,weather}])=>{
   const base=evaluate(district,weather,'baseline');
   const projection=evaluate(district,weather,'proyeksi');
   return {id,province:district.p,name:district.k,point:district.pt||null,
    baseline:base.items.map(item=>item.cls),proyeksi:projection.items.map(item=>item.cls),
    triggers:base.items.map(item=>item.trig),scores:[base.score,projection.score]};
  });
 },{once:true});
}

// Executed inside the WebGIS page once the same national rendering is ready.
export async function readMonitoringDetail() {
 const engine=window.HidrometEWS;
 const districts=window.readMonitoringDistricts();
 const byName=new Map(districts.map(d=>[d.name+', '+d.province,d]));
 const response=await fetch('data/kantor_bi.json');
 if (!response.ok) throw Error('Direktori kantor WebGIS gagal');
 const directory=new Map((await response.json()).kantor.map(o=>[o.id,o]));
 const offices=[...document.querySelectorAll('#biMatrix tbody tr')].map(row=>{
  const o=directory.get(row.dataset.id), area=row.cells[0].querySelector('small').textContent.trim();
  let district=byName.get(area);
  // WebGIS uses its closest district point if village and district spellings differ.
  if (!district && area.includes(', ')) {
   let nearest=Infinity;
   for (const d of districts) {
    if (!d.point) continue;
    const dist=(d.point[0]-o.lat)**2+(d.point[1]-o.lon)**2;
    if (dist<nearest) {nearest=dist;district=d;}
   }
  }
  if (district) {
   const codes=['–','R','S','T'];
   const cells=[...row.querySelectorAll('.bi-cell')];
   if (!district.baseline.every((v,i)=>cells[i]?.textContent.trim()===codes[v])) throw Error('Kelas wilayah dan kantor berbeda');
  }
  return {id:o.id,name:row.cells[0].querySelector('b').textContent.trim(),type:o.jenis,
   district:district?.id||null,point:[o.lat,o.lon]};
 });
 if (!districts.length || offices.length!==directory.size) throw Error('Rincian wilayah belum lengkap');
 return {districts,offices,hazards:engine.HAZARDS.map(({name,short,icon})=>({name,short,icon})),
  matrix:engine.MATRIX,classes:engine.HAZ_CLASS,triggers:engine.TRIG_NAME,
  statuses:engine.STATUS.map(({name,desc})=>({name,description:desc}))};
}

export async function readOfficeRaster(page) {
 await page.waitForSelector('#biMatrix tbody tr[data-id]',{state:'attached',timeout:32_000});
 await page.locator('#biInfoMode [data-v="titik"]').evaluate(el=>el.click());
 // Keep any completed samples if one of the seven raster services times out.
 await page.waitForFunction(()=>document.querySelector('#biInfoSub')?.textContent.includes('raster')
  && !document.querySelector('#biInfoSub')?.textContent.includes('membaca raster'),null,{timeout:93_000})
  .catch(error=>{if(error.name!=='TimeoutError') throw error;});
 const rows=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#biMatrix tbody tr[data-id]')].map(tr=>[
  tr.dataset.id,[...tr.querySelectorAll('.bi-cell')].map(cell=>({'–':0,R:1,S:2,T:3})[cell.textContent.trim()]??null)
 ])));
 const values=Object.values(rows).flat();
 if (!values.some(Number.isInteger)) throw Error('Raster InaRISK belum dapat dibaca');
 return {asOf:new Date().toISOString(),rows,complete:values.every(Number.isInteger)};
}
