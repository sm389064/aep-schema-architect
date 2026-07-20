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
  if(typeof v==='boolean') return 'boolean';
  if(typeof v==='number') return Number.isInteger(v)?'integer':'number';
  if(typeof v==='string'){
    if(/^\d{4}-\d{2}-\d{2}T[\d:.+-Z]+$/.test(v)) return 'date-time';
    if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date';
    if(/^\//.test(v)) return 'string'; // URI references like "/uri-reference"
  }
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

// Normalize a header for comparison: lowercase, strip everything but letters/digits,
// so "data_type", "Data Type" and "datatype" all compare equal.
function normKey(s){ return (s||'').toString().trim().toLowerCase().replace(/[^a-z0-9]/g,''); }

// Find the raw column key matching one of the given aliases. Tries an exact
// normalized match first, then falls back to the column name *containing*
// an alias as a substring (e.g. "source_column_nm" contains "sourcecolumn"),
// so real-world naming variants (snake_case, abbreviations, extra suffixes
// like "_nm") still match. Deliberately one-directional: matching on an
// alias merely containing the column name would let a short/garbage header
// (e.g. a stray "a" column) false-match almost any alias.
function findCol(keys,aliases){
  const normAliases=aliases.map(normKey);
  let hit=keys.find(k=>normAliases.includes(normKey(k)));
  if(hit)return hit;
  return keys.find(k=>{
    const nk=normKey(k);
    return nk&&normAliases.some(a=>a&&nk.includes(a));
  });
}

function processSourceSheet(raw){
  if(!raw.length)return[];
  const keys=Object.keys(raw[0]);
  const colKey=findCol(keys,['source data column','source column','source','column name','field name','column','attribute'])||keys[0];
  const typeKey=findCol(keys,['source data type','data type','type','datatype']);
  const descKey=findCol(keys,['description','desc','definition','business definition']);
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

function parseAEPExport(arr){
  // Build lookup: $id -> object
  const byId={};
  arr.forEach(obj=>{ if(obj.$id) byId[obj.$id]=obj; });

  // Separate by resource type
  const datatypes=arr.filter(o=>o['meta:resourceType']==='datatypes');
  const mixins=arr.filter(o=>o['meta:resourceType']==='mixins');
  const schemas=arr.filter(o=>o['meta:resourceType']==='schemas');
  const descriptors=arr.filter(o=>o['meta:resourceType']==='descriptors');

  // Identity descriptors: sourceProperty -> { isPrimary, namespace }
  const identityMap={};
  descriptors.forEach(d=>{
    if(d['@type']==='xdm:descriptorIdentity'&&d['xdm:sourceProperty']){
      const prop=d['xdm:sourceProperty'];
      identityMap[prop]={ isPrimary:!!d['xdm:isPrimary'], namespace:d['xdm:namespace']||'' };
    }
  });

  // Detect tenant from mixin properties key starting with '_'
  // Scans all definition keys (not just 'customFields') to handle any naming convention
  let tenant='';
  for(const mx of mixins){
    if(!mx.definitions) continue;
    for(const defKey of Object.keys(mx.definitions)){
      const props=mx.definitions[defKey]&&mx.definitions[defKey].properties;
      if(!props) continue;
      const tk=Object.keys(props).find(k=>k.startsWith('_'));
      if(tk){ tenant=tk; break; }
    }
    if(tenant) break;
  }

  // Recursively resolve a datatype $ref to get its properties
  function resolveDatatype(ref){
    const dt=byId[ref];
    if(!dt) return {};
    const props={};
    const defs=dt.definitions&&dt.definitions.customFields&&dt.definitions.customFields.properties;
    if(defs) Object.assign(props,defs);
    if(dt.allOf) dt.allOf.forEach(a=>{
      if(a.$ref&&byId[a.$ref]){
        Object.assign(props,resolveDatatype(a.$ref));
      }
    });
    return props;
  }

  function resolveXdmType(def){
    const mt=def['meta:xdmType'];
    if(mt&&mt!=='object'&&mt!=='array') return mt;
    if(def.format==='date-time'||def.format==='date') return def.format;
    return def.type||'string';
  }

  function buildDesc(def){
    let d=def.description||'';
    if(def.enum&&def.enum.length){
      const enumLabels=def['meta:enum']||{};
      const enumStr=def.enum.map(v=>enumLabels[v]?`${v} (${enumLabels[v]})`:v).join(', ');
      d+=(d?' · ':'')+'Enum: '+enumStr;
    }
    return d;
  }

  // Walk properties, return flat array of field descriptors
  function walkProps(props, pathParts, fgName, fgClass){
    const fields=[];
    if(!props) return fields;
    Object.entries(props).forEach(([key,def])=>{
      if(!def||typeof def!=='object') return;
      const xdmType=def['meta:xdmType']||def.type||'string';

      if(xdmType==='object'||def.type==='object'){
        let nestedProps=def.properties||null;
        if(!nestedProps&&def.$ref&&byId[def.$ref]){
          nestedProps=resolveDatatype(def.$ref);
        }
        if(nestedProps&&Object.keys(nestedProps).length>0){
          fields.push(...walkProps(nestedProps,[...pathParts,key],fgName,fgClass));
          return;
        }
      }

      if(xdmType==='array'||def.type==='array'){
        const items=def.items;
        if(items&&items.$ref&&byId[items.$ref]){
          const nestedProps=resolveDatatype(items.$ref);
          if(nestedProps&&Object.keys(nestedProps).length>0){
            fields.push(...walkProps(nestedProps,[...pathParts,key],fgName,fgClass));
            return;
          }
        }
      }

      // Leaf field
      const fullPathParts=[...pathParts,key];
      const leafXdmType=resolveXdmType(def);
      const title=def.title||toDisplayName(key);
      const desc=buildDesc(def);
      const objPathParts=pathParts.filter(p=>p!==tenant);

      const identityPropKey='/'+fullPathParts.join('/');
      const identityInfo=identityMap[identityPropKey]||null;
      const identityVal=identityInfo?(identityInfo.isPrimary?'Primary':'Secondary'):'';

      const row=blankRow(objPathParts.join('.'));
      row["Source Data Column"]=key;
      row["Source Data Type"]=leafXdmType;
      row["AEP Field Name"]=toCamel(key);
      row["AEP Display Name"]=title;
      row["Description"]=desc;
      row["XDM Data Type"]=leafXdmType;
      row["Field Group Name"]=fgName;
      row["Field Group Classification"]=fgClass;
      row["Primary/Secondary Identity"]=identityVal;
      const xdmPathParts=[];
      if(fgClass==='Custom'&&tenant) xdmPathParts.push(tenant);
      objPathParts.forEach(p=>xdmPathParts.push(p));
      xdmPathParts.push(key);
      row["XDM Column Path"]=xdmPathParts.join('.');
      fields.push(row);
    });
    return fields;
  }

  const rows=[];
  let fieldGroupCount=0;

  // If we have mixins, walk them in schema allOf order if schema exists
  let mixinOrder=mixins;
  if(schemas.length>0){
    const schema=schemas[0];
    const refs=(schema.allOf||[]).map(a=>a.$ref).filter(Boolean);
    const ordered=refs.map(r=>byId[r]).filter(Boolean).filter(o=>o['meta:resourceType']==='mixins');
    const orderedIds=new Set(ordered.map(o=>o.$id));
    mixinOrder=[...ordered,...mixins.filter(m=>!orderedIds.has(m.$id))];
  }

  mixinOrder.forEach(mx=>{
    const fgName=mx.title||'';
    let props=null;
    if(mx.definitions){
      for(const defKey of Object.keys(mx.definitions)){
        const p=mx.definitions[defKey]&&mx.definitions[defKey].properties;
        if(p){ props=p; break; }
      }
    }
    if(!props) return;

    const tenantNode=tenant&&props[tenant];
    if(tenantNode&&tenantNode.properties){
      Object.entries(tenantNode.properties).forEach(([objKey,objDef])=>{
        let leafProps=null;
        if(objDef.$ref&&byId[objDef.$ref]){
          leafProps=resolveDatatype(objDef.$ref);
        } else if(objDef.properties){
          leafProps=objDef.properties;
        }
        if(leafProps){
          const fields=walkProps(leafProps,[tenant,objKey],fgName,'Custom');
          rows.push(...fields);
        }
      });
    } else {
      const fields=walkProps(props,[],fgName,'OOTB');
      rows.push(...fields);
    }
    fieldGroupCount++;
  });

  // If no mixins but datatypes exist, walk datatypes directly
  if(mixinOrder.length===0&&datatypes.length>0){
    datatypes.forEach(dt=>{
      const fgName=dt.title||'';
      const props=dt.definitions&&dt.definitions.customFields&&dt.definitions.customFields.properties;
      if(!props) return;
      const fields=walkProps(props,[],fgName,'Custom');
      rows.push(...fields);
      fieldGroupCount++;
    });
  }

  return { rows, tenant, fieldGroupCount };
}

/* ─── parseAPISchema ───────────────────────────────────────────────────────
 * Parses a single AEP schema object returned by the Schema Registry API
 * (Accept: application/vnd.adobe.xed-full+json; version=1).
 * Returns { rows, tenant, fieldGroupCount } matching parseAEPExport's format.
 */
function parseAPISchema(schemaObj) {
  const props = schemaObj.properties || {};

  // Detect tenant key: starts with _, not a system key, is an object
  const tenant = Object.keys(props).find(k =>
    k.startsWith('_') && !['_id','_repo'].includes(k) &&
    props[k] && typeof props[k] === 'object' && !Array.isArray(props[k])
  ) || '';

  const rows = [];
  let fieldGroupCount = 0;

  function resolveXdmType(def) {
    const mt = def['meta:xdmType'];
    if (mt && mt !== 'object' && mt !== 'array') return mt;
    if (def.format === 'date-time' || def.format === 'date') return def.format;
    return def.type || 'string';
  }

  function buildDesc(def) {
    let d = def.description || '';
    if (def.enum && def.enum.length) {
      const enumLabels = def['meta:enum'] || {};
      const enumStr = def.enum.map(v => enumLabels[v] ? `${v} (${enumLabels[v]})` : v).join(', ');
      d += (d ? ' · ' : '') + 'Enum: ' + enumStr;
    }
    return d;
  }

  // Recursively walk schema properties and return flat row array
  function walkProps(nodeProps, pathParts, fgName, fgClass) {
    const fields = [];
    if (!nodeProps) return fields;

    Object.entries(nodeProps).forEach(([key, def]) => {
      if (!def || typeof def !== 'object') return;

      const xdmType = def['meta:xdmType'] || def.type || 'string';
      const isObj = xdmType === 'object' || def.type === 'object';
      const isArr = xdmType === 'array' || def.type === 'array';

      // Object with nested properties — recurse
      if (isObj && def.properties && Object.keys(def.properties).length > 0) {
        fields.push(...walkProps(def.properties, [...pathParts, key], fgName, fgClass));
        return;
      }

      // Array of objects — recurse into items
      if (isArr && def.items) {
        const itemProps = def.items.properties;
        if (itemProps && Object.keys(itemProps).length > 0) {
          fields.push(...walkProps(itemProps, [...pathParts, key], fgName, fgClass));
          return;
        }
        // allOf inside items
        if (def.items.allOf) {
          const merged = {};
          def.items.allOf.forEach(a => a.properties && Object.assign(merged, a.properties));
          if (Object.keys(merged).length > 0) {
            fields.push(...walkProps(merged, [...pathParts, key], fgName, fgClass));
            return;
          }
        }
      }

      // Leaf field
      const objPathParts = pathParts.filter(p => p !== tenant);
      const leafXdmType  = resolveXdmType(def);
      const title        = def.title || toDisplayName(key);
      const desc         = buildDesc(def);

      const row = blankRow(objPathParts.join('.'));
      row["Source Data Column"]        = key;
      row["Source Data Type"]          = leafXdmType;
      row["AEP Field Name"]            = toCamel(key);
      row["AEP Display Name"]          = title;
      row["Description"]               = desc;
      row["XDM Data Type"]             = leafXdmType;
      row["Field Group Name"]          = fgName;
      row["Field Group Classification"] = fgClass;

      const xdmParts = [];
      if (fgClass === 'Custom' && tenant) xdmParts.push(tenant);
      objPathParts.forEach(p => xdmParts.push(p));
      xdmParts.push(key);
      row["XDM Column Path"] = xdmParts.join('.');

      fields.push(row);
    });

    return fields;
  }

  // ── Custom (tenant) field groups ────────────────────────────────────────
  if (tenant && props[tenant] && props[tenant].properties) {
    Object.entries(props[tenant].properties).forEach(([fgKey, fgDef]) => {
      const fgName   = fgDef.title || fgKey;
      const fgProps  = fgDef.properties || null;
      const fgFields = fgProps
        ? walkProps(fgProps, [tenant, fgKey], fgName, 'Custom')
        : walkProps({ [fgKey]: fgDef }, [tenant], fgName, 'Custom');
      rows.push(...fgFields);
      if (fgFields.length) fieldGroupCount++;
    });
  }

  // ── OOTB (non-tenant) fields ────────────────────────────────────────────
  const ootbSeen = new Set();
  Object.entries(props).forEach(([key, def]) => {
    if (!def || typeof def !== 'object') return;
    if (key === tenant || key.startsWith('_')) return; // skip tenant + system keys
    const fgName   = def.title || key;
    const fgFields = walkProps({ [key]: def }, [], fgName, 'OOTB');
    rows.push(...fgFields);
    if (fgFields.length && !ootbSeen.has(fgName)) { ootbSeen.add(fgName); fieldGroupCount++; }
  });

  return { rows, tenant, fieldGroupCount };
}
