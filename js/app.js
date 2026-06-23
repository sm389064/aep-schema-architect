/* ─── STATE ─── */
let data = [];
let groupOrder = [];
let collapsed = {};
let customCols = [];
let history = [];
let redoStack = [];
let visibleCols = new Set([...DEFAULT_VISIBLE]);
let filterValues = {};
let tempWB = null;
let mode = '';
let jsonRows = [];
let s2Touched = false;
let prevSelCount = 0;
let syncLock = false;
let _dragSrcIdx = null;

/* ─── HELPERS ─── */
function allCols(){return[...STD_COLS,...customCols];}
function allVisibleCols(){return[...STD_COLS,...customCols].filter(c=>visibleCols.has(c));}

function blankRow(op){
  const row={};allCols().forEach(c=>row[c]='');row.__objectPath=op||'';row.__arrSeg=null;return row;
}

function hasIdentity(indices){
  return indices.some(i=>{
    const v=data[i]&&data[i]["Primary/Secondary Identity"];
    return v==='Primary'||v==='Secondary';
  });
}

/* ─── HISTORY ─── */
function snap(){
  return JSON.stringify({
    data:data.map(r=>({...r})),
    collapsed,
    customCols:[...customCols],
    groupOrder:[...groupOrder],
    visibleCols:[...visibleCols]
  });
}
function pushH(){history.push(snap());if(history.length>40)history.shift();redoStack=[];updUR();}
function restore(s){
  const p=JSON.parse(s);
  data=p.data;collapsed=p.collapsed||{};customCols=p.customCols||[];
  groupOrder=p.groupOrder||[];
  if(p.visibleCols)visibleCols=new Set(p.visibleCols);
  renderTable();updUR();
}
function undo(){if(!history.length)return;redoStack.push(snap());restore(history.pop());}
function redo(){if(!redoStack.length)return;history.push(snap());restore(redoStack.pop());}
function updUR(){
  document.getElementById('undoBtn').disabled=!history.length;
  document.getElementById('redoBtn').disabled=!redoStack.length;
}

/* ─── GROUP ORDER ─── */
function initGroupOrder(){
  const seen=new Set();
  data.forEach(r=>{seen.add(r.__objectPath||'');});
  groupOrder=[...seen];
}

function promoteGroups(updatedPaths){
  const known=new Set(groupOrder);
  updatedPaths.forEach(p=>{if(!known.has(p)){groupOrder.push(p);known.add(p);}});
  data.forEach(r=>{const k=r.__objectPath||'';if(!known.has(k)){known.add(k);groupOrder.push(k);}});
}

/* ─── SCROLL SYNC ─── */
function syncH(){
  if(syncLock)return;syncLock=true;
  document.getElementById('tblScroll').scrollLeft=document.getElementById('hbar').scrollLeft;
  syncLock=false;
}
function updateHbar(){
  const t=document.getElementById('tblScroll'),inner=document.getElementById('hbarInner');
  if(t&&inner)inner.style.width=t.scrollWidth+'px';
}

/* ─── IS ARRAY dropdown ─── */
function getSelectedRows(){
  return Array.from(document.querySelectorAll('.rc:checked')).map(cb=>data[parseInt(cb.dataset.i)]).filter(Boolean);
}
function refreshArrDropdown(){
  const sel=document.getElementById('cArray');
  const rows=getSelectedRows();
  if(!rows.length){
    sel.disabled=false;
    sel.innerHTML=`<option value=""></option>
      <option value="__attr">Attribute (leaf)</option>
      <option value="__obj_last">Last Object Node</option>`;
    return;
  }
  const paths=new Set(rows.map(r=>r.__objectPath||''));
  if(paths.size>1){
    sel.disabled=true;
    sel.innerHTML=`<option>Multiple object paths — select same path rows</option>`;
    return;
  }
  sel.disabled=false;
  const sharedPath=[...paths][0];
  const tenant=document.getElementById('cTenant').value.trim()||extractTenant(rows[0]["XDM Column Path"]);
  const fgClass=rows[0]["Field Group Classification"]||document.getElementById('cFGClass').value;
  const segs=[];
  if(fgClass==='Custom'&&tenant)segs.push(tenant);
  if(sharedPath)sharedPath.split('.').filter(Boolean).forEach(s=>segs.push(s));
  let opts=`<option value=""></option>`;
  segs.forEach((s,idx)=>{opts+=`<option value="${esc(s)}">${ordLabel(idx)} Object (${s})</option>`;});
  opts+=`<option value="__attr">Attribute (leaf)</option>`;
  sel.innerHTML=opts;
  const cur=sel.dataset.current||'';
  if(cur){const found=[...sel.options].some(o=>o.value===cur);if(found)sel.value=cur;}
}
function onArrChange(){document.getElementById('cArray').dataset.current=document.getElementById('cArray').value;}

/* ─── FILE INPUT ─── */
function setupFileInput(){
  document.getElementById('fileInput').addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const nm=f.name.toLowerCase();const r=new FileReader();
    r.onload=ev=>{
      if(nm.endsWith('.json')){
        mode='json';
        try{
          const obj=JSON.parse(ev.target.result);
          if(Array.isArray(obj)){
            // Format 2: AEP schema export
            const result=parseAEPExport(obj);
            jsonRows=result.rows;
            const tenant=result.tenant||'(detected from data)';
            const fgCount=result.fieldGroupCount;
            document.getElementById('sheetBox').style.display='none';
            document.getElementById('loadBtn').style.display='inline-flex';
            note(`AEP Schema Export · Tenant: <b>${tenant}</b> · ${jsonRows.length} fields · ${fgCount} field groups`);
          } else {
            // Format 1: existing XDM instance data
            jsonRows=parseXDM(obj);
            document.getElementById('sheetBox').style.display='none';
            document.getElementById('loadBtn').style.display='inline-flex';
            note(`JSON · Tenant: <b>${detectTenant(obj)||'none'}</b> · ${jsonRows.length} fields`);
          }
        }catch(err){setStatus('Invalid JSON: '+err.message,true);}
      } else {
        mode='sheet';
        tempWB=XLSX.read(ev.target.result,{type:'binary'});
        document.getElementById('sheetSelect').innerHTML=tempWB.SheetNames.map(n=>`<option>${n}</option>`).join('');
        document.getElementById('sheetBox').style.display='flex';
        document.getElementById('loadBtn').style.display='inline-flex';
        note('Spreadsheet ready — choose a sheet and click Load');
      }
    };
    if(nm.endsWith('.json'))r.readAsText(f);else r.readAsBinaryString(f);
  });
}

function loadData(){
  pushH();collapsed={};s2Touched=false;prevSelCount=0;
  document.getElementById('cTenant').value='';
  document.getElementById('cFieldGroup').value='';
  document.getElementById('cFGClass').value='Custom';
  document.getElementById('cObjectPath').value='';
  document.getElementById('cIdentity').value='';
  if(mode==='json'){
    data=jsonRows.map(r=>({...r}));
    data.forEach(r=>customCols.forEach(c=>{if(r[c]===undefined)r[c]='';}));
    setStatus(`Loaded ${data.length} fields from XDM JSON.`);
  } else {
    if(!tempWB){history.pop();updUR();return;}
    const sheet=tempWB.Sheets[document.getElementById('sheetSelect').value];
    const raw=XLSX.utils.sheet_to_json(sheet,{defval:""});
    if(!raw.length){setStatus('Sheet is empty',true);history.pop();updUR();return;}
    data=processSourceSheet(raw);
    setStatus(`Loaded ${data.length} columns.`);
  }
  filterValues={};
  initGroupOrder();
  renderTable();
}

/* ─── ADD ROW ─── */
function addRow(op){
  pushH();
  let path=op||'';
  if(!path){
    const checked=Array.from(document.querySelectorAll('.rc:checked'));
    if(checked.length)path=data[parseInt(checked[checked.length-1].dataset.i)].__objectPath||'';
  }
  const row=blankRow(path);
  if(path){
    let last=-1;data.forEach((r,i)=>{if(r.__objectPath===path)last=i;});
    if(last>=0)data.splice(last+1,0,row);else data.push(row);
  } else data.push(row);
  if(path&&!groupOrder.includes(path))groupOrder.push(path);
  if(!path&&!groupOrder.includes(''))groupOrder.push('');
  renderTable();setStatus('Blank row added — all cells are editable.');
  if(!path)setTimeout(()=>{const w=document.getElementById('tblScroll');if(w)w.scrollTop=w.scrollHeight;},60);
}

/* ─── COLUMNS ─── */
function openAddColModal(){
  document.getElementById('newColName').value='';
  openModal('addColModal');
  setTimeout(()=>document.getElementById('newColName').focus(),80);
}
function commitAddCol(){
  const name=document.getElementById('newColName').value.trim();
  if(!name){setStatus('Name required',true);return;}
  if(allCols().map(c=>c.toLowerCase()).includes(name.toLowerCase())){setStatus(`"${name}" already exists`,true);return;}
  pushH();customCols.push(name);data.forEach(r=>r[name]='');
  visibleCols.add(name);
  closeModal('addColModal');renderTable();setStatus(`Column "${name}" added.`);
}
function openManageColsModal(){renderColTags();document.getElementById('newColName2').value='';openModal('manageColsModal');}
function renderColTags(){
  document.getElementById('customColTags').innerHTML=customCols.length
    ?customCols.map(c=>`<span class="col-tag">${c}<span class="col-tag-x" onclick="removeCol('${esc(c)}')">×</span></span>`).join('')
    :'<span style="font-size:11px;color:#aaa">No custom columns yet.</span>';
}
function commitAddCol2(){
  const name=document.getElementById('newColName2').value.trim();if(!name)return;
  if(allCols().map(c=>c.toLowerCase()).includes(name.toLowerCase())){setStatus(`"${name}" already exists`,true);return;}
  pushH();customCols.push(name);data.forEach(r=>r[name]='');
  visibleCols.add(name);
  document.getElementById('newColName2').value='';renderTable();renderColTags();setStatus(`Column "${name}" added.`);
}
function removeCol(name){
  if(!confirm(`Remove "${name}" and all its data?`))return;
  pushH();customCols=customCols.filter(c=>c!==name);data.forEach(r=>delete r[name]);
  visibleCols.delete(name);
  renderTable();renderColTags();setStatus(`Column "${name}" removed.`);
}

/* ─── APPLY MAPPING ─── */
function applyMapping(){
  const sel=Array.from(document.querySelectorAll('.rc:checked')).map(cb=>parseInt(cb.dataset.i));
  if(!sel.length){setStatus('No rows selected.',true);return;}
  pushH();
  const tenant=document.getElementById('cTenant').value.trim();
  const fg=document.getElementById('cFieldGroup').value.trim();
  const fgClass=document.getElementById('cFGClass').value;
  const objPath=document.getElementById('cObjectPath').value.trim();
  const arrSel=document.getElementById('cArray');
  const arrSeg=arrSel.disabled?null:(arrSel.value||null);
  const identity=document.getElementById('cIdentity').value;

  if(identity==='Primary')
    data.forEach(r=>{if(r["Primary/Secondary Identity"]==='Primary')r["Primary/Secondary Identity"]='';});

  const updatedPaths=new Set();
  sel.forEach((i,idx)=>{
    const row=data[i];
    if(fg)row["Field Group Name"]=fg;
    row["Field Group Classification"]=fgClass;
    row.__objectPath=objPath;
    row.__arrSeg=arrSeg;
    row["Array"]=arrSeg?(arrSeg==='__attr'?`${row["AEP Field Name"]}[]`:`${arrSeg}[]`):'';
    if(identity==='Primary')row["Primary/Secondary Identity"]=idx===0?'Primary':'Secondary';
    else if(identity)row["Primary/Secondary Identity"]=identity;
    row["XDM Column Path"]=buildPath(tenant,fgClass,objPath,row["AEP Field Name"]||'',arrSeg);
    if(objPath)updatedPaths.add(objPath);
  });

  if(updatedPaths.size>0)promoteGroups([...updatedPaths]);
  updatedPaths.forEach(p=>{if(!groupOrder.includes(p))groupOrder.unshift(p);});

  renderTable();setStatus(`Applied to ${sel.length} row(s).`);
}

/* ─── DELETE ─── */
function deleteRow(i){pushH();data.splice(i,1);renderTable();setStatus('Row deleted.');}
function deleteSelected(){
  const sel=Array.from(document.querySelectorAll('.rc:checked')).map(cb=>parseInt(cb.dataset.i));
  if(!sel.length)return;
  if(!confirm(`Delete ${sel.length} row${sel.length>1?'s':''}?`))return;
  pushH();sel.sort((a,b)=>b-a).forEach(i=>data.splice(i,1));
  renderTable();setStatus(`Deleted ${sel.length} row${sel.length>1?'s':''}.`);
}

/* ─── CELL HANDLERS ─── */
function openIdentityEdit(i,td){
  const row=data[i];if(!row)return;
  const cur=row["Primary/Secondary Identity"]||'';
  td.outerHTML=`<select class="isel" onchange="cellIdentityChange(${i},this)" onblur="renderTable()">
    <option value=""></option>
    <option value="Primary" ${cur==='Primary'?'selected':''}>Primary</option>
    <option value="Secondary" ${cur==='Secondary'?'selected':''}>Secondary</option>
  </select>`;
}
function cellIdentityChange(i,el){
  const val=el.value;if(!data[i])return;
  pushH();
  if(val==='Primary')data.forEach(r=>{if(r["Primary/Secondary Identity"]==='Primary')r["Primary/Secondary Identity"]='';});
  data[i]["Primary/Secondary Identity"]=val;
  renderTable();
}
function cellSelChange(i,col,el){
  const val=el.value;if(!data[i])return;
  pushH();data[i][col]=val;renderTable();
}
function editCell(i,col,val){
  if(!data[i]||data[i][col]===val)return;
  pushH();data[i][col]=val;
  if(col==="AEP Field Name"){
    // Bug fix: also update Array when arrSeg is __attr
    if(data[i].__arrSeg==='__attr'){
      data[i]["Array"]=val+'[]';
    }
    const tenant=document.getElementById('cTenant').value.trim()||extractTenant(data[i]["XDM Column Path"]);
    data[i]["XDM Column Path"]=buildPath(tenant,data[i]["Field Group Classification"],data[i].__objectPath,val,data[i].__arrSeg);
    renderTable();
  }
}

/* ─── SELECTION ─── */
function toggleGroup(key){collapsed[key]=!collapsed[key];renderTable();}
function toggleGroupRows(key,cb){
  document.querySelectorAll(`.arow[data-grp="${CSS.escape(key)}"] .rc`).forEach(x=>{
    x.checked=cb.checked;x.closest('tr').classList.toggle('sel',cb.checked);
  });
  prevSelCount=document.querySelectorAll('.rc:checked').length;
  updSel();updateCtxStrip();refreshArrDropdown();
}
function toggleAll(src){
  document.querySelectorAll('.rc').forEach(cb=>{
    cb.checked=src.checked;cb.closest('tr').classList.toggle('sel',src.checked);
  });
  prevSelCount=document.querySelectorAll('.rc:checked').length;
  updSel();updateCtxStrip();refreshArrDropdown();
}

function s2IsBlank(){
  return!document.getElementById('cTenant').value.trim()
    &&!document.getElementById('cFieldGroup').value.trim()
    &&!document.getElementById('cObjectPath').value.trim()
    &&document.getElementById('cIdentity').value==='';
}

function loadFromRow(idx){
  const row=data[idx];if(!row)return;
  const t=extractTenant(row["XDM Column Path"]);
  if(t)document.getElementById('cTenant').value=t;
  document.getElementById('cFieldGroup').value=row["Field Group Name"]||'';
  document.getElementById('cFGClass').value=row["Field Group Classification"]||'Custom';
  document.getElementById('cObjectPath').value=row.__objectPath||'';
  const idv=row["Primary/Secondary Identity"]||'';
  document.getElementById('cIdentity').value=['Primary','Secondary'].includes(idv)?idv:'';
  s2Touched=false;refreshArrDropdown();updateCtxStrip();
}

function updateCtxStrip(){
  const checked=Array.from(document.querySelectorAll('.rc:checked'));
  const ctx=document.getElementById('cfgCtx');
  if(!checked.length){ctx.className='cfg-ctx none';ctx.innerHTML='';return;}
  const fi=parseInt(checked[0].dataset.i);const fr=data[fi];
  const paths=new Set(checked.map(cb=>data[parseInt(cb.dataset.i)].__objectPath||''));
  const ll=`<span class="load-link" onclick="loadFromRow(${fi})">&#8593; Load into controls</span>`;
  if(checked.length===1)
    {ctx.className='cfg-ctx single';ctx.innerHTML=`<i class="ti ti-info-circle"></i> Selected: <b>${fr["Source Data Column"]||'(blank row)'}</b> ${ll}`;}
  else if(paths.size===1)
    {ctx.className='cfg-ctx single';ctx.innerHTML=`<i class="ti ti-info-circle"></i> ${checked.length} rows · same object path ${ll}`;}
  else
    {ctx.className='cfg-ctx mixed';ctx.innerHTML=`<i class="ti ti-alert-triangle"></i> ${checked.length} rows · multiple object paths — Apply updates all. ${ll}`;}
}

/* ─── META TOGGLE ─── */
function toggleMetaFields(){
  const panel=document.getElementById('metaFields');
  const chev=document.getElementById('metaChevron');
  const open=panel.style.display==='none';
  panel.style.display=open?'flex':'none';
  panel.style.flexWrap='wrap';
  panel.style.gap='8px';
  chev.className=open?'ti ti-chevron-down':'ti ti-chevron-right';
}

/* ─── DRAG & DROP ROWS ─── */
function rowDragStart(e, idx){
  _dragSrcIdx=idx;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain', idx);
  setTimeout(()=>{
    const rows=document.querySelectorAll('.arow');
    rows.forEach(r=>{if(parseInt(r.querySelector('[data-i]')?.dataset.i)===idx)r.style.opacity='.4';});
  },0);
}

function rowDragEnd(e){
  document.querySelectorAll('.arow').forEach(r=>{r.style.opacity='';r.classList.remove('drag-over');});
  _dragSrcIdx=null;
}

function rowDragOver(e, idx){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  document.querySelectorAll('.arow').forEach(r=>r.classList.remove('drag-over'));
  const tr=document.querySelector(`.arow [data-i="${idx}"]`)?.closest('tr');
  if(tr) tr.classList.add('drag-over');
}

function rowDrop(e, targetIdx){
  e.preventDefault();
  document.querySelectorAll('.arow').forEach(r=>r.classList.remove('drag-over'));
  const srcIdx=_dragSrcIdx;
  if(srcIdx===null||srcIdx===targetIdx) return;

  const srcRow=data[srcIdx];
  const tgtRow=data[targetIdx];
  const srcPath=srcRow.__objectPath||'';
  const tgtPath=tgtRow.__objectPath||'';

  if(srcPath===tgtPath){
    // Same group — simple reorder
    pushH();
    data.splice(srcIdx,1);
    const newTarget=targetIdx>srcIdx?targetIdx-1:targetIdx;
    data.splice(newTarget,0,srcRow);
    renderTable();
    setStatus('Row moved.');
  } else {
    // Different group — confirm path change
    const fieldName=srcRow["AEP Field Name"]||srcRow["Source Data Column"]||'this field';
    const msg=`Move "${fieldName}" from group "${srcPath||'(root)'}" to "${tgtPath||'(root)'}"?\n\nThis will update its XDM Column Path.`;
    if(!confirm(msg)) return;

    const newFG=prompt(
      `Update Field Group Name for "${fieldName}"?\nCurrent: "${srcRow["Field Group Name"]||'(none)'}" — enter new name or leave blank to keep current.`,
      srcRow["Field Group Name"]||''
    );

    pushH();
    srcRow.__objectPath=tgtPath;
    const tenant=extractTenant(srcRow["XDM Column Path"])||document.getElementById('cTenant').value.trim();
    srcRow["XDM Column Path"]=buildPath(tenant,srcRow["Field Group Classification"],tgtPath,srcRow["AEP Field Name"],srcRow.__arrSeg);
    if(newFG!==null&&newFG.trim()!=='') srcRow["Field Group Name"]=newFG.trim();

    data.splice(srcIdx,1);
    const newTarget=targetIdx>srcIdx?targetIdx-1:targetIdx;
    data.splice(newTarget,0,srcRow);

    if(tgtPath&&!groupOrder.includes(tgtPath)) groupOrder.push(tgtPath);
    renderTable();
    setStatus('Row moved to new group. Path updated.');
  }
}

/* ─── MISC ─── */
function note(msg){document.getElementById('upNote').innerHTML=msg||'';}
function clearAll(){
  if(!confirm('Clear everything?'))return;
  pushH();data=[];collapsed={};customCols=[];groupOrder=[];s2Touched=false;prevSelCount=0;
  visibleCols=new Set([...DEFAULT_VISIBLE]);
  filterValues={};
  renderTable();setStatus('');note('');
  document.getElementById('fileInput').value='';
  document.getElementById('sheetBox').style.display='none';
  document.getElementById('loadBtn').style.display='none';
  document.getElementById('cfgCtx').className='cfg-ctx none';
  document.getElementById('cfgCtx').innerHTML='';
  refreshArrDropdown();
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded',function(){
  // Scroll sync
  document.getElementById('tblScroll').addEventListener('scroll',()=>{
    if(syncLock)return;syncLock=true;
    document.getElementById('hbar').scrollLeft=document.getElementById('tblScroll').scrollLeft;
    syncLock=false;
  });

  // Step 2 field tracking
  ['cTenant','cFieldGroup','cFGClass','cObjectPath','cArray','cIdentity'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.addEventListener('input',()=>s2Touched=true);el.addEventListener('change',()=>s2Touched=true);}
  });

  // Modal backdrop close on click outside modal box
  document.querySelectorAll('.modal-bg').forEach(bg=>{
    bg.addEventListener('click',function(e){
      if(e.target===bg){
        bg.classList.remove('open');
      }
    });
  });

  setupFileInput();
  refreshArrDropdown();
  renderTable();
  updUR();
  window.addEventListener('resize',updateHbar);
});
