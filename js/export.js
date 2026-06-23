/* ─── EXPORT ─── */

function exportExcel(){
  const schemaName=(document.getElementById('schemaName').value||'').trim()||'AEP_mapping';
  const allDataCols=[...STD_COLS,...customCols];

  let tenant='';
  for(const r of data){
    const t=extractTenant(r["XDM Column Path"]);
    if(t){tenant=t;break;}
  }

  const groups=buildGroups();
  const orderedRows=[];
  groups.forEach(g=>g.indices.forEach(i=>orderedRows.push(data[i])));

  const wsData=[];
  wsData.push(["Schema",schemaName,"","Tenant",tenant,"","Generated",new Date().toISOString(),"","Tool","AEP Schema Architect v1.0"]);
  wsData.push([]);
  wsData.push(allDataCols);
  orderedRows.forEach(r=>wsData.push(allDataCols.map(c=>r[c]||'')));

  const ws=XLSX.utils.aoa_to_sheet(wsData);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Mapping");
  XLSX.writeFile(wb,schemaName+'_mapping.xlsx');
}

function exportJSON(){
  const schemaName=(document.getElementById('schemaName').value||'').trim()||'AEP_mapping';
  const allDataCols=[...STD_COLS,...customCols];

  const fgMap={};
  data.forEach(r=>{
    const fg=r["Field Group Name"]||'';
    if(!fg)return;
    if(!fgMap[fg])fgMap[fg]={name:fg,classification:r["Field Group Classification"]||'',fieldCount:0,objectPath:r.__objectPath||''};
    fgMap[fg].fieldCount++;
  });

  const groups=buildGroups();
  const orderedRows=[];
  groups.forEach(g=>g.indices.forEach(i=>orderedRows.push(data[i])));

  const contract={
    version:"1.0",
    generatedBy:"AEP Schema Architect Phase 1",
    generatedAt:new Date().toISOString(),
    schemaName,
    columns:allDataCols,
    rows:orderedRows.map(r=>{
      const out={};
      allDataCols.forEach(c=>out[c]=r[c]||'');
      return out;
    }),
    fieldGroups:Object.values(fgMap),
    agentNotes:[]
  };

  const blob=new Blob([JSON.stringify(contract,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=schemaName+'_contract.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function copySampleJson(){
  const txt=document.getElementById('sampleJsonPre').textContent;
  navigator.clipboard.writeText(txt).then(()=>setStatus('Sample JSON copied!')).catch(()=>setStatus('Copy failed',true));
}
