"""Import the user's review workbook without inferring coordinates or approving evidence."""
import sys,json,hashlib,collections,math
from pathlib import Path
from openpyxl import load_workbook
path=Path(sys.argv[1]);root=Path(__file__).resolve().parents[1];target=root/'public/locations.json';data=json.loads(target.read_text());by_id={d['id']:d for d in data}
workbook=load_workbook(path,data_only=True);rows=list(workbook['Koordinat 133 Lokasi'].values)[1:];seen=set();counts=collections.Counter()
for row in rows:
 if not row[0]:continue
 ident=str(row[0]);assert ident in by_id and ident not in seen, f'Unknown/duplicate ID: {ident}';seen.add(ident);d=by_id[ident]
 lat,lng=row[5:7];provided=lat is not None or lng is not None
 if provided:assert all(isinstance(v,(int,float)) and math.isfinite(v) for v in [lat,lng]) and -12<=lat<=7 and 94<=lng<=142,f'Invalid coordinates: {ident}'
 status='ready_for_review' if row[9]=='Siap ditinjau' and provided else 'needs_confirmation' if provided else 'not_found'
 d['legacyCityCoords']=[row[12],row[13]];d['coords']=[lat,lng] if provided else None;d['submittedOfficeCoords']=d['coords'];d['verifiedOfficeCoords']=None
 for name,index in [('name',2),('bank',3),('kpw',4),('city',14),('region',15)]:
  value=row[index]
  # Empty region for KPw in the workbook is retained; UI derives region only for grouping.
  d[name]='' if value is None else str(value)
 d['legacySource']=row[17] or '';d['legacyCoordinateStatus']=row[18] or '';d['plafond']=row[16];d['address']=row[7] or '';d['sourceUrl']=row[8] or '';d['submissionStatus']=row[9] or '';d['submissionNotes']=row[10] or '';d['searchUrl']=row[11] or ''
 d['status']=status;d['coordinateAccuracy']='submitted_office' if provided else 'missing';d['source']=path.name;d['coordinateEvidence']=[]
 d['coordinateReview']={'status':status,'reviewScope':'Diimpor apa adanya dari file pengguna; sumber belum diverifikasi ulang oleh aplikasi.','sourceStatus':row[9] or '', 'notes':row[10] or ''};counts[status]+=1
assert seen==set(by_id), 'Missing IDs';assert len(rows)==133
meta={'sourceFile':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'total':len(data),'withCoordinates':sum(d['coords'] is not None for d in data),'statusCounts':dict(counts),'policy':'No inferred coordinates; submitted review status is not independent verification.','additionalRowsImported':0}
target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');(root/'public/coordinate-import.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print(json.dumps(meta,ensure_ascii=False))
