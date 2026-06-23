/* ─── RENDER ─── */

function esc(s){
  return(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setStatus(msg,err){
  const el=document.getElementById('statusbar');el.textContent=msg;el.className='statusbar'+(err?' err':'');
  if(msg)setTimeout(()=>{if(el.textContent===msg)el.textContent='';},4000);
}

function openModal(id){
  const el=document.getElementById(id);
  el.classList.add('open');
}

function closeModal(id){
  document.getElementById(id).classList.remove('open');
}

function updSel(){
  const n=document.querySelectorAll('.rc:checked').length;
  const total=document.querySelectorAll('.rc').length;
  document.getElementById('selCount').textContent=n;
  document.getElementById('delCount').textContent=n;
  document.getElementById('delSelBtn').style.display=n>0?'inline-flex':'none';

  // Update group-level checkboxes indeterminate state
  document.querySelectorAll('.grp-chk').forEach(grpCb=>{
    const grpKey=grpCb.closest('tr').nextElementSibling;
    // find the group row and get its data-grp key from sibling rows
    const tr=grpCb.closest('tr');
    // walk forward siblings to find arow rows for this group
    const band=tr.querySelector('.grp-band');
    if(!band)return;
    // get the group key from the toggleGroupRows onclick attr
    const onclick=grpCb.getAttribute('onclick')||'';
    const m=onclick.match(/toggleGroupRows\('([^']*)',/);
    if(!m)return;
    const key=m[1];
    const groupRows=document.querySelectorAll(`.arow[data-grp="${CSS.escape(key)}"] .rc`);
    const checked=[...groupRows].filter(x=>x.checked).length;
    grpCb.checked=checked===groupRows.length&&groupRows.length>0;
    grpCb.indeterminate=checked>0&&checked<groupRows.length;
  });

  // Update "select all" header checkbox
  const allCbs=document.querySelectorAll('.rc');
  const allCk=[...allCbs].filter(x=>x.checked).length;
  const headerCb=document.querySelector('thead input[type=checkbox]');
  if(headerCb){
    headerCb.checked=allCk===allCbs.length&&allCbs.length>0;
    headerCb.indeterminate=allCk>0&&allCk<allCbs.length;
  }
}

function onRowCheck(cb){
  cb.closest('tr').classList.toggle('sel',cb.checked);
  const cur=document.querySelectorAll('.rc:checked').length;
  if(cur===1&&prevSelCount===0&&!s2Touched&&s2IsBlank())loadFromRow(parseInt(cb.dataset.i));
  prevSelCount=cur;
  updSel();
  updateCtxStrip();
  refreshArrDropdown();
}

function refreshColPickerList(){
  const all=allCols();
  const list=document.getElementById('colPickerList');
  if(!list)return;
  list.innerHTML='';
  all.forEach(c=>{
    const lbl=document.createElement('label');
    lbl.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;cursor:pointer;font-size:12px;color:#333';
    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.checked=visibleCols.has(c);
    cb.style.cssText='width:14px;height:14px;accent-color:#1473e6;flex-shrink:0';
    cb.addEventListener('change',function(){
      if(this.checked)visibleCols.add(c);else visibleCols.delete(c);
      renderTable();
    });
    const span=document.createElement('span');
    span.textContent=c;
    lbl.appendChild(cb);lbl.appendChild(span);
    list.appendChild(lbl);
  });
}

function openColPicker(){
  refreshColPickerList();
  openModal('colPickerModal');
}

function showAllCols(){
  allCols().forEach(c=>visibleCols.add(c));
  renderTable();
  refreshColPickerList();
}

function hideAllCols(){
  visibleCols=new Set([...DEFAULT_VISIBLE]);
  filterValues={};
  renderTable();
  refreshColPickerList();
}

function renderTable(){
  const cols=allVisibleCols();
  const hasData=data.length>0;
  document.getElementById('mtEmpty').style.display=hasData?'none':'flex';
  const filteredCount=hasActiveFilters()?data.filter(r=>rowMatchesFilters(r)).length:data.length;
  document.getElementById('rowCount').textContent=hasActiveFilters()?`${filteredCount} of ${data.length} (filtered)`:data.length;
  const cfBtn=document.getElementById('clearFiltersBtn');
  if(cfBtn)cfBtn.style.display=hasActiveFilters()?'inline-flex':'none';
  const totalCols=cols.length+2;
  prevSelCount=0;
  document.getElementById('manageColsBtn').style.display=customCols.length?'inline-flex':'none';
  document.getElementById('customColCount').textContent=customCols.length||'';

  const _flt=filterValues;
  document.getElementById('mtHead').innerHTML=`<tr>
    <th class="tdchk"><input type="checkbox" onclick="toggleAll(this)"></th>
    ${cols.map(c=>{
      const isCC=customCols.includes(c);
      const star=isCC?'<i class="ti ti-star" style="font-size:10px;margin-right:3px;color:#c8a800"></i>':'';
      const activeFlt=_flt[c]&&_flt[c].size>0;
      const activeCount=activeFlt?_flt[c].size:0;
      const thStyle=activeFlt?'background:#eef5ff;':'';
      const filterBadge=activeFlt
        ?`<span class="flt-badge" title="${activeCount} filter${activeCount>1?'s':''} applied">${activeCount}</span>`
        :'';
      return `<th ${isCC?'class="custom-col"':''} style="${thStyle}">
        <div class="th-wrap" onclick="openColFilter(event,'${esc(c)}')">
          ${star}${c}${filterBadge}&nbsp;<span class="th-arr" style="${activeFlt?'color:#1473e6':''}">&#8964;</span>
        </div>
      </th>`;
    }).join('')}
    <th class="tddel" style="position:sticky;right:0;z-index:21;background:#f0f0f0;min-width:30px"></th>
  </tr>`;

  const groups=buildGroups();
  let html='';
  groups.forEach(g=>{
    if(!g.indices.length)return;
    const label=g.key||'(root / no object)';
    const isCol=!!collapsed[g.key];
    html+=`<tr class="grp-row"><td colspan="${totalCols}"><div class="grp-band">
      <i class="ti ti-chevron-${isCol?'right':'down'} grp-chev" onclick="toggleGroup('${esc(g.key)}')"></i>
      <input type="checkbox" class="grp-chk" onclick="toggleGroupRows('${esc(g.key)}',this)">
      <i class="ti ti-box grp-ico"></i>
      <span class="grp-label">${label}</span>
      <span class="grp-tag">object</span>
      <span class="grp-count">${g.indices.length} attribute${g.indices.length!==1?'s':''}</span>
      <button class="grp-add" onclick="event.stopPropagation();addRow('${esc(g.key)}')">
        <i class="ti ti-plus"></i> Add row here
      </button>
    </div></td></tr>`;

    const visibleIndices=isCol?[]:g.indices.filter(i=>rowMatchesFilters(data[i]));
    if(isCol||!visibleIndices.length){
      if(hasActiveFilters()&&!isCol&&!visibleIndices.length)return;
      if(isCol)return;
    }

    visibleIndices.forEach(i=>{
      const row=data[i];
      const idVal=row["Primary/Secondary Identity"]||'';
      html+=`<tr class="arow" data-grp="${esc(g.key)}">
        <td class="tdchk"><input type="checkbox" class="rc" data-i="${i}" onchange="onRowCheck(this)"></td>
        ${cols.map(c=>{
          const val=row[c]||'';
          const isCC=customCols.includes(c);
          const td=isCC?'cc':'';

          if(c==="Primary/Secondary Identity"){
            if(idVal==='Primary'){
              return `<td class="${td}" title="Click to change identity">
                <span class="id-badge id-primary" onclick="openIdentityEdit(${i},this)">Primary</span>
              </td>`;
            }
            if(idVal==='Secondary'){
              return `<td class="${td}" title="Click to change identity">
                <span class="id-badge id-secondary" onclick="openIdentityEdit(${i},this)">Secondary</span>
              </td>`;
            }
            return `<td class="${td}">
              <select class="isel" onchange="cellIdentityChange(${i},this)">
                <option value=""></option>
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
              </select>
            </td>`;
          }

          if(c==="Array"){
            const fgCls=row["Field Group Classification"]||'Custom';
            const tenant=extractTenant(row["XDM Column Path"])||document.getElementById('cTenant').value.trim();
            const segs=[];
            if(fgCls==='Custom'&&tenant)segs.push(tenant);
            if(row.__objectPath)row.__objectPath.split('.').filter(Boolean).forEach(s=>segs.push(s));
            const leafName=row["AEP Field Name"]||'';
            let opts=`<option value="" ${!row.__arrSeg?'selected':''}></option>`;
            segs.forEach((s,idx)=>{opts+=`<option value="${esc(s)}" ${row.__arrSeg===s?'selected':''}>${ordLabel(idx)} Object (${s})</option>`;});
            opts+=`<option value="__attr" ${row.__arrSeg==='__attr'?'selected':''}>Attribute (${leafName||'leaf'})</option>`;
            return `<td class="${td}"><select class="isel" onchange="cellArrChange(${i},this)">${opts}</select></td>`;
          }

          if(c==="isRequired"){
            return `<td class="${td}"><select class="isel" onchange="cellSelChange(${i},'isRequired',this)">
              <option value="" ${!val?'selected':''}></option>
              <option value="Yes" ${val==='Yes'?'selected':''}>Yes</option>
              <option value="No" ${val==='No'?'selected':''}>No</option>
            </select></td>`;
          }

          if(c==="Field Group Classification"){
            return `<td class="${td}"><select class="isel" onchange="cellSelChange(${i},'Field Group Classification',this)">
              <option value="" ${!val?'selected':''}></option>
              <option value="Custom" ${val==='Custom'?'selected':''}>Custom</option>
              <option value="OOTB" ${val==='OOTB'?'selected':''}>OOTB</option>
            </select></td>`;
          }

          if(c==="XDM Data Type"){
            const opts=XDM_TYPES.map(t=>`<option value="${t}" ${t===val?'selected':''}>${t}</option>`).join('');
            return `<td class="${td}"><select class="isel" onchange="cellSelChange(${i},'XDM Data Type',this)">
              <option value=""></option>${opts}
            </select></td>`;
          }

          if(c==="XDM Column Path"){
            return `<td class="${td}">
              <div class="ce tdpath" contenteditable="true"
                onblur="editCell(${i},'XDM Column Path',this.innerText.trim())">${val}</div>
            </td>`;
          }

          if(c==="AEP Field Name"){
            return `<td class="${td}">
              <div class="ce" contenteditable="true" title="Auto-converts to camelCase"
                onblur="enforceCamel(${i},this)">${val}</div>
            </td>`;
          }

          if(c==="AEP Display Name"){
            return `<td class="${td}">
              <div class="ce" contenteditable="true"
                onblur="editCell(${i},'AEP Display Name',this.innerText.trim())">${val}</div>
            </td>`;
          }

          return `<td class="${td}">
            <div class="ce" contenteditable="true"
              onblur="editCell(${i},'${esc(c)}',this.innerText.trim())">${val}</div>
          </td>`;
        }).join('')}
        <td class="tddel"><button class="del-row-btn" onclick="deleteRow(${i})"><i class="ti ti-x"></i></button></td>
      </tr>`;
    });
  });

  document.getElementById('mtBody').innerHTML=html;
  setTimeout(updateHbar,40);
  updSel();
  updateCtxStrip();
}
