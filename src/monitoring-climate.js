const number = new Intl.NumberFormat('id-ID',{maximumFractionDigits:2,signDisplay:'exceptZero'});
const months = new Intl.DateTimeFormat('id-ID',{month:'short',year:'numeric',timeZone:'UTC'});
const valueLabel = value => number.format(value)+' °C';

function oniTrend(card,values) {
 const chart=card.querySelector('[data-oni-series]');
 const limit=Math.max(1,...values.map(row=>Math.abs(row.value)));
 for (const {season,year,value} of values) {
  const col=document.createElement('span');
  const bar=document.createElement('i');
  col.dataset.sign=value<0?'negative':'positive';
  col.title=`${season} ${year}: ${valueLabel(value)}`;
  bar.style.setProperty('--bar-height',Math.max(1,Math.abs(value)/limit*100)+'%');
  col.append(bar);chart.append(col);
 }
 chart.setAttribute('aria-label',values.map(({season,year,value})=>`${season} ${year}: ${valueLabel(value)}`).join('; '));
 chart.hidden=false;
}

export function mountMonitoringClimate(card) {
 let lastCheck=0;
 async function refresh() {
  if (Date.now()-lastCheck<3600000) return;
  lastCheck=Date.now();
  let data;
  try {
   const response=await fetch('/api/climate-indices',{signal:AbortSignal.timeout(10000)});
   data=await response.json();
  } catch { data={}; }
  for (const key of ['oni','dmi']) {
   const values=data[key];
   const panel=card.querySelector(`[data-index="${key}"]`);
   const value=panel.querySelector('strong');
   const period=panel.querySelector('[data-period]');
   const latest=values?.at(-1);
   if (!latest) {
    if (value.textContent==='—') period.textContent='Sumber belum tersedia';
    continue;
   }
   value.textContent=valueLabel(latest.value);
   period.textContent=key==='oni'?`${latest.season} ${latest.year}`:months.format(new Date(Date.UTC(latest.year,latest.month-1,1)));
  }
  if(data.oni?.length){
   card.querySelector('[data-oni-series]').replaceChildren();
   oniTrend(card,data.oni);
  }
 }
 return refresh;
}
