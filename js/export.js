/* ─── EXPORT ─── */

function metaVal(id){ return (document.getElementById(id)||{}).value||''; }

async function exportExcel(){
  const schemaName=(document.getElementById('schemaName').value||'').trim()||'AEP_mapping';
  const allDataCols=[...STD_COLS,...customCols];
  const totalCols=allDataCols.length;

  let tenant='';
  for(const r of data){const t=extractTenant(r["XDM Column Path"]);if(t){tenant=t;break;}}

  const groups=buildGroups();
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('Mapping');

  // ── Column widths (chars) — sized so 10 default-visible cols fit without horizontal scroll
  const CW={
    "Source Data Column":20,"Source Data Type":14,"Description":25,
    "Primary/Secondary Identity":20,"AEP Field Name":16,"AEP Display Name":16,
    "XDM Column Path":26,"XDM Data Type":14,"Array":14,"isRequired":12,
    "Relationship":14,"Field Group Name":20,"Field Group Classification":22,
    "Modeling":14,"Pre-transformations Required?":18,"Transformations Desc":20,
    "Contract Labels":14,"Identity Labels":14,"Sensitive Labels":14,
    "Display Name":16,"Component Type":14,"Attribution Settings":16,
    "XDM Script Mixin":18,"XDM Script DULE":18
  };
  ws.columns=allDataCols.map(c=>({width:CW[c]||15}));

  // ── Row 1: solid black decorative bar
  const r1=ws.addRow([]);
  r1.height=10;
  for(let c=1;c<=totalCols;c++){
    r1.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF000000'}};
    r1.getCell(c).border={
      top:{style:'thin',color:{argb:'FF000000'}},bottom:{style:'thin',color:{argb:'FF000000'}},
      left:{style:'thin',color:{argb:'FF000000'}},right:{style:'thin',color:{argb:'FF000000'}}
    };
  }

  // ── Metadata rows — bold label in col A, plain value in col B
  const META=[
    ['Change Date',      metaVal('mChangeDate')],
    ['Consultant',       metaVal('mConsultant')],
    null,
    ['XDM Schema Name',  metaVal('mSchemaName')],
    ['XDM Schema Type',  metaVal('mSchemaType')],
    ['XDM Dataset Name', metaVal('mDatasetName')],
    null,
    ['Source Table Name',metaVal('mSourceTable')],
    ['Source',           metaVal('mSource')],
    ['Upload Method',    metaVal('mUploadMethod')],
    ['Update Frequency', metaVal('mUpdateFreq')],
    ['Tenant',           tenant],
    null,
  ];
  META.forEach(m=>{
    if(!m){ws.addRow([]);return;}
    const r=ws.addRow(m);
    r.getCell(1).font={bold:true,size:11,name:'Calibri'};
    r.getCell(1).alignment={vertical:'middle'};
    r.getCell(2).font={bold:false,size:11,name:'Calibri'};
    r.getCell(2).alignment={vertical:'middle',wrapText:true};
  });

  // ── Column header row
  const headerRowNum=ws.rowCount+1;
  const hRow=ws.addRow(allDataCols);
  hRow.height=32;
  hRow.eachCell({includeEmpty:true},(cell,cn)=>{
    if(cn>totalCols)return;
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD0D3D4'}};
    cell.font={bold:true,size:11,name:'Calibri',color:{argb:'FF1A1A1A'}};
    cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};
    cell.border={
      top:{style:'thin',color:{argb:'FF9E9E9E'}},
      bottom:{style:'medium',color:{argb:'FF5A5A5A'}},
      left:{style:'thin',color:{argb:'FFB0B0B0'}},
      right:{style:'thin',color:{argb:'FFB0B0B0'}}
    };
  });

  // ── Freeze panes so header stays visible while scrolling
  ws.views=[{
    state:'frozen',ySplit:headerRowNum,xSplit:0,
    topLeftCell:`A${headerRowNum+1}`,activeCell:`A${headerRowNum+1}`
  }];

  // ── Data rows with a thin gray separator row before each group
  const SEP_FILL={type:'pattern',pattern:'solid',fgColor:{argb:'FFE0E0E0'}};
  const CELL_BDR={
    top:{style:'hair',color:{argb:'FFCCCCCC'}},bottom:{style:'hair',color:{argb:'FFCCCCCC'}},
    left:{style:'hair',color:{argb:'FFCCCCCC'}},right:{style:'hair',color:{argb:'FFCCCCCC'}}
  };

  groups.forEach(g=>{
    // Gray divider row before each group
    const sep=ws.addRow([]);
    sep.height=6;
    for(let c=1;c<=totalCols;c++){sep.getCell(c).fill=SEP_FILL;}

    g.indices.forEach((idx,ri)=>{
      const row=data[idx];
      const dr=ws.addRow(allDataCols.map(c=>row[c]||''));
      dr.height=18;
      dr.eachCell({includeEmpty:true},(cell,cn)=>{
        if(cn>totalCols)return;
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ri%2===0?'FFFFFFFF':'FFF8F8F8'}};
        cell.font={size:10,name:'Calibri'};
        cell.alignment={vertical:'top',wrapText:true};
        cell.border=CELL_BDR;
      });
    });
  });

  // ── Download
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=schemaName+'_mapping.xlsx';
  a.click();
  URL.revokeObjectURL(a.href);
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
