/* ─── PARSER ─── */

function extractTenant(path){
  if(!path)return'';
  const f=(path||'').split('.')[0];
  return f.startsWith('_')?f:'';
}

function toCamel(s){
  s=(s||'').toString().trim();
  const p=s.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if(!p.length)return s.toLowerCase();
  return p.map((x,i)=>{x=x.toLowerCase();return i===0?x:x.charAt(0).toUpperCase()+x.slice(1);}).join('');
}

function toDisplayName(s){
  return(s||'').toString().trim()
    .replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2')
    .toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).trim();
}

function buildPath(tenant,fgClass,objPath,leafName,arrSeg){
  const segs=[];
  if(fgClass==='Custom'&&tenant)segs.push(tenant);
  if(objPath)objPath.split('.').filter(Boolean).forEach(s=>segs.push(s));
  if(leafName&&leafName.trim())segs.push(leafName);
  return segs.map((s,i)=>{
    const isLeaf=i===segs.length-1;
    if(arrSeg==='__attr'&&isLeaf)return s+'[]';
    if(arrSeg&&!isLeaf&&s===arrSeg)return s+'[]';
    return s;
  }).filter(Boolean).join('.');
}

function detectTenant(obj){
  for(const k in obj)
    if(k.startsWith('_')&&k!=='_id'&&k!=='_repo'&&obj[k]&&typeof obj[k]==='object'&&!Array.isArray(obj[k]))return k;
  return null;
}

function inferType(v){
  if(typeof v==='boolean')return 'boolean';
  if(typeof v==='number')return Number.isInteger(v)?'integer':'number';
  if(typeof v==='string'){if(/^\d{4}-\d{2}-\d{2}T/.test(v))return 'date-time';if(/^\d{4}-\d{2}-\d{2}$/.test(v))return 'date';}
  return 'string';
}

function parseXDM(obj){
  const tenant=detectTenant(obj);const out=[];
  function walk(node,parts,arrAncSeg){
    if(Array.isArray(node)){
      if(node.length&&typeof node[0]==='object'&&!Array.isArray(node[0]))walk(node[0],parts,parts[parts.length-1]);
      else out.push(makeRow(parts.join('.'),tenant,node.length?inferType(node[0]):'string',parts[parts.length-1]));
      return;
    }
    if(node&&typeof node==='object'){for(const k in node)walk(node[k],parts.concat(k),arrAncSeg);return;}
    out.push(makeRow(parts.join('.'),tenant,inferType(node),arrAncSeg||null));
  }
  walk(obj,[],null);return out;
}

function makeRow(fullPath,tenant,type,arrSeg){
  const parts=fullPath.split('.');const leaf=parts[parts.length-1];
  const underTenant=tenant&&parts[0]===tenant;
  const objParts=underTenant?parts.slice(1,-1):parts.slice(0,-1);
  const row=blankRow(objParts.join('.'));
  row["Source Data Column"]=leaf;
  row["Source Data Type"]=type;row["XDM Data Type"]=type;
  row["AEP Field Name"]=toCamel(leaf);
  row["AEP Display Name"]=toDisplayName(leaf);
  row["XDM Column Path"]=fullPath;
  row["Field Group Classification"]=underTenant?'Custom':'OOTB';
  row.__arrSeg=arrSeg||null;
  row["Array"]=arrSeg?arrSeg+'[]':'';
  return row;
}

function enforceCamel(i,el){
  const camel=toCamel(el.innerText);
  if(el.innerText.trim()!==camel)el.innerText=camel;
  editCell(i,'AEP Field Name',camel);
}

function cellArrChange(i,el){
  const val=el.value;if(!data[i])return;
  pushH();
  const row=data[i];
  row.__arrSeg=val||null;
  row["Array"]=val?(val==='__attr'?`${row["AEP Field Name"]}[]`:`${val}[]`):'';
  // Bug fix: also update Array field when arrSeg is __attr
  if(val==='__attr') row["Array"]=row["AEP Field Name"]+'[]';
  // Bug fix: extract tenant from XDM Column Path first, fall back to input
  const tenant=extractTenant(row["XDM Column Path"])||document.getElementById('cTenant').value.trim();
  row["XDM Column Path"]=buildPath(tenant,row["Field Group Classification"],row.__objectPath,row["AEP Field Name"],val||null);
  renderTable();
}

function processSourceSheet(raw){
  if(!raw.length)return[];
  const keys=Object.keys(raw[0]);
  const find=a=>keys.find(k=>a.includes(k.trim().toLowerCase()));
  const colKey=find(['source data column','source column','source','column name','field name','column','attribute'])||keys[0];
  const typeKey=find(['source data type','data type','type','datatype']);
  const descKey=find(['description','desc','definition','business definition']);
  return raw.map(r=>{
    const src=(r[colKey]||'').toString();if(!src.trim())return null;
    const row=blankRow('');
    row["Source Data Column"]=src;
    row["Source Data Type"]=typeKey?(r[typeKey]||'string'):'string';
    row["XDM Data Type"]=row["Source Data Type"];
    row["Description"]=descKey?(r[descKey]||''):'';
    row["AEP Field Name"]=toCamel(src);
    row["AEP Display Name"]=toDisplayName(src);
    return row;
  }).filter(Boolean);
}
