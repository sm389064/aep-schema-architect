/* ─── EXPORT ─── */

function metaVal(id){ return (document.getElementById(id)||{}).value||''; }

async function exportExcel(){
  const schemaName=(document.getElementById('schemaName').value||'').trim()||'AEP';
  const allDataCols=[...STD_COLS,...customCols];
  const N=allDataCols.length;

  let tenant='';
  for(const r of data){const t=extractTenant(r["XDM Column Path"]);if(t){tenant=t;break;}}

  const groups=buildGroups();

  const wb=new ExcelJS.Workbook();
  wb.creator='AEP Schema Architect';
  const ws=wb.addWorksheet('Mapping');

  // ── Sheet settings
  ws.views=[{
    state:'frozen', ySplit:15, xSplit:1,
    topLeftCell:'B16', showGridLines:false,
    activeCell:'B16'
  }];
  ws.pageSetup.orientation='landscape';
  ws.pageSetup.fitToPage=true;
  ws.pageSetup.fitToWidth=1;
  ws.pageSetup.margins={left:0.5,right:0.5,top:0.75,bottom:0.75,header:0.3,footer:0.3};

  // ── Column widths (spec: A-X = 24 standard cols)
  const COL_WIDTHS=[
    23.3125,15.3125,10.734375,23.20703125,13.7890625,20.0,40.0,14.0,14.0,12.0,
    14.0,22.0,22.0,16.0,20.0,20.0,16.0,16.0,16.0,16.0,16.0,18.0,18.0,16.0
  ];
  COL_WIDTHS.forEach((w,i)=>{ ws.getColumn(i+1).width=w; });
  for(let i=24;i<N;i++) ws.getColumn(i+1).width=15;

  // ── Colour palette
  const C={
    META_LABEL_BG:'FFC8C8C8',
    META_VAL_BG:  'FFF5F5F5',
    DIVIDER_BG:   'FFC8C8C8',
    HDR_BG:       'FFC8C8C8',
    HDR_FG:       'FF1A1A1A',
    GRP_BG:       'FFE8E8E8',
    GRP_FG:       'FF333333',
    ODD:          'FFFFFFFF',
    EVEN:         'FFF7F7F7',
    DATA_FG:      'FF1A1A1A',
    ID_PRI_BG:    'FFE6EBFF',
    ID_PRI_FG:    'FF3146D0',
    ID_SEC_BG:    'FFF1E8FF',
    ID_SEC_FG:    'FF7C3DC0',
  };

  function sf(argb){return{type:'pattern',pattern:'solid',fgColor:{argb}};}
  function af(size,bold,argb){return{name:'Arial',size,bold,color:{argb}};}
  const TB={
    top:{style:'thin'},bottom:{style:'thin'},
    left:{style:'thin'},right:{style:'thin'}
  };
  const NB={};  // no border — raw Excel default

  function styleMetaLabel(cell,val){
    cell.value=val;
    cell.font=af(10,true,'FF1A1A1A');
    cell.fill=sf(C.META_LABEL_BG);
    cell.alignment={horizontal:'left',vertical:'middle'};
    cell.border=TB;
  }
  function styleMetaVal(cell,val){
    cell.value=(val!==undefined&&val!==null)?val:'';
    cell.font=af(10,false,'FF1A1A1A');
    cell.fill=sf(C.META_VAL_BG);
    cell.alignment={horizontal:'left',vertical:'middle'};
    cell.border=TB;
  }

  // ──────────────────────────────────────────
  // ROW 1 — Title banner
  // ──────────────────────────────────────────
  ws.getRow(1).height=22.2;
  ws.mergeCells(1,1,1,N);
  const t1=ws.getCell(1,1);
  t1.value='AEP XDM Data Mapping Document';
  t1.font=af(13,true,'FF1A1A1A');
  t1.fill=sf(C.META_LABEL_BG);
  t1.alignment={horizontal:'left',vertical:'middle'};
  // no border per spec

  // ──────────────────────────────────────────
  // ROWS 2–13 — Metadata block
  // ──────────────────────────────────────────
  // Row 2
  ws.getRow(2).height=16.0;
  styleMetaLabel(ws.getCell(2,1),'Change Date');
  styleMetaVal(ws.getCell(2,2),metaVal('mChangeDate'));
  styleMetaVal(ws.getCell(2,3),null);

  // Row 3 — no explicit height (default)
  styleMetaLabel(ws.getCell(3,1),'Consultant');
  styleMetaVal(ws.getCell(3,2),metaVal('mConsultant'));
  styleMetaVal(ws.getCell(3,3),null);

  // Row 4 — DIVIDER "SCHEMA"
  ws.getRow(4).height=16.5;
  ws.mergeCells(4,1,4,3);
  const d4=ws.getCell(4,1);
  d4.value='SCHEMA';
  d4.font=af(13,true,'FF1A1A1A');
  d4.fill=sf(C.DIVIDER_BG);
  d4.alignment={horizontal:'left',vertical:'middle'};
  d4.border=TB;
  // D:X on row 4 — completely plain, do not touch

  // Row 5
  ws.getRow(5).height=16.0;
  styleMetaLabel(ws.getCell(5,1),'XDM Schema Name');
  styleMetaVal(ws.getCell(5,2),metaVal('mSchemaName'));
  styleMetaVal(ws.getCell(5,3),null);

  // Row 6
  ws.getRow(6).height=16.0;
  styleMetaLabel(ws.getCell(6,1),'XDM Schema Type');
  styleMetaVal(ws.getCell(6,2),metaVal('mSchemaType'));
  styleMetaVal(ws.getCell(6,3),null);

  // Row 7
  ws.getRow(7).height=16.0;
  styleMetaLabel(ws.getCell(7,1),'XDM Dataset Name');
  styleMetaVal(ws.getCell(7,2),metaVal('mDatasetName'));
  styleMetaVal(ws.getCell(7,3),null);

  // Row 8 — DIVIDER "SOURCE"
  ws.getRow(8).height=16.5;
  ws.mergeCells(8,1,8,3);
  const d8=ws.getCell(8,1);
  d8.value='SOURCE';
  d8.font=af(13,true,'FF1A1A1A');
  d8.fill=sf(C.DIVIDER_BG);
  d8.alignment={horizontal:'left',vertical:'middle'};
  d8.border=TB;
  // D:X on row 8 — completely plain, do not touch

  // Row 9
  ws.getRow(9).height=16.0;
  styleMetaLabel(ws.getCell(9,1),'Source Table Name');
  styleMetaVal(ws.getCell(9,2),metaVal('mSourceTable'));
  styleMetaVal(ws.getCell(9,3),null);

  // Row 10
  ws.getRow(10).height=16.0;
  styleMetaLabel(ws.getCell(10,1),'Source');
  styleMetaVal(ws.getCell(10,2),metaVal('mSource'));
  styleMetaVal(ws.getCell(10,3),null);

  // Row 11
  ws.getRow(11).height=16.0;
  styleMetaLabel(ws.getCell(11,1),'Upload Method');
  styleMetaVal(ws.getCell(11,2),metaVal('mUploadMethod'));
  styleMetaVal(ws.getCell(11,3),null);

  // Row 12
  ws.getRow(12).height=16.0;
  styleMetaLabel(ws.getCell(12,1),'Update Frequency');
  styleMetaVal(ws.getCell(12,2),metaVal('mUpdateFreq'));
  styleMetaVal(ws.getCell(12,3),null);

  // Row 13
  ws.getRow(13).height=16.0;
  styleMetaLabel(ws.getCell(13,1),'Tenant');
  styleMetaVal(ws.getCell(13,2),tenant);
  styleMetaVal(ws.getCell(13,3),null);

  // ──────────────────────────────────────────
  // ROW 14 — Spacer: completely untouched
  // ──────────────────────────────────────────
  ws.getRow(14).height=19.2;
  // no styling, no fill, no border — raw Excel default

  // ──────────────────────────────────────────
  // ROW 15 — Column headers (no explicit height per spec)
  // ──────────────────────────────────────────
  allDataCols.forEach((col,ci)=>{
    const cell=ws.getCell(15,ci+1);
    cell.value=col;
    cell.font=af(10,true,C.HDR_FG);
    cell.fill=sf(C.HDR_BG);
    cell.border=TB;
    cell.alignment={
      horizontal:ci===0?'left':'center',
      vertical:'middle',
      wrapText:false
    };
  });

  // ──────────────────────────────────────────
  // ROWS 16+ — Group bands + data rows
  // ──────────────────────────────────────────
  let rowNum=16;

  groups.forEach(g=>{
    const label=g.key||'(root / no object path)';
    const cnt=g.indices.length;

    // Group band
    ws.getRow(rowNum).height=18;
    ws.mergeCells(rowNum,1,rowNum,N);
    const gc=ws.getCell(rowNum,1);
    gc.value=`${label}  (${cnt} attribute${cnt!==1?'s':''})`;
    gc.font=af(10,true,C.GRP_FG);
    gc.fill=sf(C.GRP_BG);
    gc.alignment={horizontal:'left',vertical:'middle'};
    gc.border=TB;
    rowNum++;

    // Data rows
    g.indices.forEach(idx=>{
      const row=data[idx];
      const isOdd=rowNum%2!==0;
      const bg=isOdd?C.ODD:C.EVEN;
      ws.getRow(rowNum).height=18;

      allDataCols.forEach((col,ci)=>{
        const cell=ws.getCell(rowNum,ci+1);
        const val=row[col]||null;

        // Identity column special colouring
        if(col==='Primary/Secondary Identity'&&val){
          if(val==='Primary'){
            cell.fill=sf(C.ID_PRI_BG);
            cell.font=af(10,false,C.ID_PRI_FG);
          } else if(val==='Secondary'){
            cell.fill=sf(C.ID_SEC_BG);
            cell.font=af(10,false,C.ID_SEC_FG);
          } else {
            cell.fill=sf(bg);
            cell.font=af(10,false,C.DATA_FG);
          }
        } else {
          cell.fill=sf(bg);
          cell.font=af(10,false,C.DATA_FG);
        }

        cell.value=val;
        cell.alignment={horizontal:'left',vertical:'middle',wrapText:false};
        cell.border=TB;
      });
      rowNum++;
    });
  });

  // ── Download
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const safeName=schemaName.replace(/[^a-zA-Z0-9 \-_]/g,'').trim()||'AEP';
  a.download=`${safeName} Data Mapping Document.xlsx`;
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
