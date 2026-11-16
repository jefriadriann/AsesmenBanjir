"""Preserve source scores and blank cells; map offices by names, never by row order."""
import json,sys,re,hashlib
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
root=Path(__file__).resolve().parents[1];path=Path(sys.argv[1]);wb=load_workbook(path,data_only=True)
offices=[d for d in json.loads((root/'public/locations.json').read_text()) if d['type']=='kpw']
def norm(s):return re.sub(r'\s+',' ',re.sub(r'^kpw(?:\s+prov(?:insi)?\.?\s+|\s+)','',s.strip().lower())).strip()
lookup={norm(d['name']):d['id'] for d in offices};assert len(lookup)==46
result={'schemaVersion':1,'sourceFile':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'policy':'Imported as supplied; scores not reclassified as disaster risk; null excluded from denominator.','hazards':{},'offices':{d['id']:{'id':d['id'],'name':d['name'],'hazards':{}} for d in offices}}
for sheet in ['Banjir','Erupsi','Karhutla','Gempa']:
 s=wb[sheet];header=list(s.values)[1];score=header.index('Skor Kesiapan');result['hazards'][sheet]={'name':sheet,'itemCount':score-2,'items':[{'id':get_column_letter(i+1),'label':header[i],'column':get_column_letter(i+1)} for i in range(2,score)],'legend':{'1':'Tersedia lengkap & berfungsi baik','0.5':'Tersedia tetapi kurang / ada yang tidak berfungsi baik','0':'Tidak tersedia','null':'Data tidak tersedia pada sumber; tidak masuk denominator'}};seen=set()
 for rownum,row in enumerate(s.values,1):
  if not isinstance(row[0],(int,float)) or not row[1]:continue
  name=norm(row[1]);assert name in lookup,f'Unmapped name {row[1]}';ident=lookup[name];assert ident not in seen;seen.add(ident)
  vals=list(row[2:score]);assert all(v in [None,0,0.5,1] for v in vals),(sheet,ident)
  valid=[v for v in vals if v is not None];reported=row[score];calculated=sum(valid)/len(valid) if valid else None
  assert reported is None or calculated is not None and abs(reported-calculated)<1e-12,(sheet,ident,reported,calculated)
  result['offices'][ident]['hazards'][sheet]={'sourceOfficeName':row[1],'sheet':sheet,'row':rownum,'values':dict(zip([i['id'] for i in result['hazards'][sheet]['items']],vals)),'score':reported,'readyCount':vals.count(1),'partialCount':vals.count(.5),'unavailableCount':vals.count(0),'missingCount':vals.count(None),'denominator':len(valid),'total':len(vals)}
 assert len(seen)==46
s=wb['Sarpas All'];header=list(s.values)[1];groups={}
for rg in s.merged_cells.ranges:
 if rg.min_row==1 and rg.max_row==1:
  for col in range(rg.min_col,rg.max_col+1):groups[col]=s.cell(1,rg.min_col).value
columns=[{'id':get_column_letter(i+1),'label':header[i] or 'Tanpa judul','group':groups.get(i+1) or s.cell(1,i+1).value or 'Informasi umum'} for i in range(2,s.max_column)]
result['inventoryColumns']=columns;seen=set()
for rownum,row in enumerate(s.values,1):
 if not isinstance(row[0],(int,float)) or not row[1]:continue
 ident=lookup[norm(row[1])];assert ident not in seen;seen.add(ident);result['offices'][ident]['inventory']={'sourceOfficeName':row[1],'sheet':'Sarpas All','row':rownum,'values':{c['id']:row[i+2] for i,c in enumerate(columns)}}
assert len(seen)==46
# Only flood and explicitly relevant supporting inventory are published.
result['hazards']={'Banjir':result['hazards']['Banjir']}
keep={'AJ','AK','AL','AN','AO','AQ','AX'}
result['inventoryColumns']=[c for c in result['inventoryColumns'] if c['id'] in keep]
for record in result['offices'].values():
 record['hazards']={'Banjir':record['hazards']['Banjir']}
 record['inventory']['values']={k:v for k,v in record['inventory']['values'].items() if k in keep}
result['scope']='Sarpras banjir; infografik pengguna adalah acuan. Sheet bencana lain tidak dipublikasikan.'
(root/'public/readiness-import.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Mapped 46 unique KPw in every sheet (230 source rows), matched by normalized name, not row order.')
print('Validated 184 original scores; published Banjir only with 7 relevant supporting inventory fields. Nulls preserved.')
print('Banjir Aceh:',result['offices']['KPW-01']['hazards']['Banjir'])
