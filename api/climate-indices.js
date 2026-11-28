const oniUrl = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
const dmiUrl = 'https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.had.long.data';
const seasons = ['DJF','JFM','FMA','MAM','AMJ','MJJ','JJA','JAS','ASO','SON','OND','NDJ'];

export function parseONI(text) {
 return text.trim().split(/\r?\n/).flatMap(line => {
  const [season,year,total,anomaly] = line.trim().split(/\s+/);
  const seasonIndex = seasons.indexOf(season);
  const value = Number(anomaly);
  if (seasonIndex < 0 || !/^\d{4}$/.test(year) || !Number.isFinite(value) || Math.abs(value)>10 || !Number.isFinite(Number(total))) return [];
  return [{season,year:Number(year),value}];
 }).sort((a,b)=>a.year-b.year||seasons.indexOf(a.season)-seasons.indexOf(b.season)).slice(-12);
}

export function parseDMI(text) {
 return text.trim().split(/\r?\n/).flatMap(line => {
  const [year,...months] = line.trim().split(/\s+/);
  if (!/^\d{4}$/.test(year) || months.length!==12) return [];
  return months.flatMap((field,index)=>{
   const value=Number(field);
   return Number.isFinite(value)&&Math.abs(value)<=10 ? [{year:Number(year),month:index+1,value}] : [];
  });
 }).sort((a,b)=>a.year-b.year||a.month-b.month).slice(-12);
}

async function series(url,parse) {
 const response=await fetch(url,{signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw Error('HTTP '+response.status);
 const values=parse(await response.text());
 if(!values.length)throw Error('Seri iklim kosong');
 return values;
}

export default async function handler(req,res) {
 const [oni,dmi]=await Promise.allSettled([series(oniUrl,parseONI),series(dmiUrl,parseDMI)]);
 const complete=oni.status==='fulfilled'&&dmi.status==='fulfilled';
 res.setHeader('Cache-Control',complete?'public, s-maxage=21600, stale-while-revalidate=3600':'no-store');
 res.status(oni.status==='rejected'&&dmi.status==='rejected'?502:200).json({
  oni:oni.status==='fulfilled'?oni.value:null,
  dmi:dmi.status==='fulfilled'?dmi.value:null,
 });
}
