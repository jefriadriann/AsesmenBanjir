import GeographicLib from 'geographiclib-geodesic';
const geodesic=GeographicLib.Geodesic.WGS84;
export function locationCoords(location){const c=location.verifiedOfficeCoords;return Array.isArray(c)&&c.length===2?c:location.coords;}
export function isVerified(location){return location.status==='verified'&&Array.isArray(location.verifiedOfficeCoords)&&location.verifiedOfficeCoords.length===2;}
export function measureLocations(a,b){
 const from=locationCoords(a),to=locationCoords(b);
 for(const coords of [from,to])if(!Array.isArray(coords)||coords.length!==2||!coords.every(Number.isFinite)||Math.abs(coords[0])>90||Math.abs(coords[1])>180)throw new Error('Koordinat tidak valid.');
 const result=geodesic.Inverse(...from,...to);const line=[];
 for(let step=0;step<=64;step++){const point=geodesic.Direct(...from,result.azi1,result.s12*step/64);line.push([point.lat2,point.lon2]);}
 return {meters:result.s12,kilometers:result.s12/1000,verified:isVerified(a)&&isVerified(b),line};
}
