/* ─── FILTER ─── */

let _activeFilterDropdown=null;

function rowMatchesFilters(row){
  for(const col in filterValues){
    const fv=filterValues[col];
    if(!fv||!fv.size)continue;
    const rv=(row[col]||'').toString().trim();
    if(![...fv].some(sel=>rv===sel))return false;
  }
  return true;
}

function hasActiveFilters(){
  return Object.keys(filterValues).some(k=>filterValues[k]&&filterValues[k].size>0);
}

function uniqueVals(col){
  const vals=new Set();
  data.forEach(r=>{
    let match=true;
    for(const fc in filterValues){
      if(fc===col)continue;
      const fv=filterValues[fc];
      if(!fv||!fv.size)continue;
      const rv=(r[fc]||'').toString().trim();
      if(![...fv].some(sel=>rv===sel)){match=false;break;}
    }
    if(match){
      const v=(r[col]||'').toString().trim();
      if(v)vals.add(v);
    }
  });
  return [...vals].sort();
}

function setFilter(col,val){
  if(val===''||val===null||val===undefined){
    delete filterValues[col];
  } else {
    if(!filterValues[col])filterValues[col]=new Set();
    if(filterValues[col].has(val))filterValues[col].delete(val);
    else filterValues[col].add(val);
    if(filterValues[col].size===0)delete filterValues[col];
  }
  renderTable();
}

function clearAllFilters(){
  filterValues={};
  closeColFilter();
  renderTable();
}

function closeColFilter(){
  if(_activeFilterDropdown){_activeFilterDropdown.remove();_activeFilterDropdown=null;}
}

function openColFilter(evt,col){
  if(_activeFilterDropdown&&_activeFilterDropdown.dataset.col===col){
    closeColFilter();return;
  }
  closeColFilter();
  const th=evt.currentTarget;
  const rect=th.getBoundingClientRect();
  const sorted=uniqueVals(col);

  const dd=document.createElement('div');
  dd.className='col-filter-dropdown';
  dd.dataset.col=col;
  dd.style.top=(rect.bottom+2)+'px';
  dd.style.left=rect.left+'px';

  const hdr=document.createElement('div');
  hdr.style.cssText='padding:6px 10px 4px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0f0f0;gap:8px';
  const colLabel=document.createElement('span');
  colLabel.style.cssText='font-size:11px;font-weight:600;color:#555;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  colLabel.textContent=col;
  const clearBtn=document.createElement('span');
  clearBtn.style.cssText='font-size:10px;color:#1473e6;cursor:pointer;flex-shrink:0';
  clearBtn.textContent='Clear';
  clearBtn.onclick=()=>{setFilter(col,'');renderDropdownItems();};
  hdr.appendChild(colLabel);hdr.appendChild(clearBtn);
  dd.appendChild(hdr);

  const searchWrap=document.createElement('div');
  searchWrap.style.cssText='padding:6px 10px;border-bottom:1px solid #f0f0f0;';
  const searchInp=document.createElement('input');
  searchInp.type='text';
  searchInp.placeholder='Search values…';
  searchInp.style.cssText='width:100%;border:1px solid #ccc;border-radius:5px;padding:5px 8px;font-size:11px;font-family:inherit;outline:none;height:28px;';
  searchInp.addEventListener('focus',()=>searchInp.style.borderColor='#1473e6');
  searchInp.addEventListener('blur',()=>searchInp.style.borderColor='#ccc');
  searchInp.addEventListener('input',()=>renderDropdownItems(searchInp.value.toLowerCase().trim()));
  searchWrap.appendChild(searchInp);
  dd.appendChild(searchWrap);

  const list=document.createElement('div');
  list.style.cssText='max-height:200px;overflow-y:auto;';
  dd.appendChild(list);

  const footer=document.createElement('div');
  footer.style.cssText='padding:5px 10px;border-top:1px solid #f0f0f0;font-size:10px;color:#888;display:flex;align-items:center;justify-content:space-between;gap:8px';
  dd.appendChild(footer);

  function renderDropdownItems(search=''){
    const cur=filterValues[col]||new Set();
    const filtered=search?sorted.filter(v=>v.toLowerCase().includes(search)):sorted;
    list.innerHTML='';
    if(!search){
      const showAll=document.createElement('label');
      showAll.className='col-flt-item col-flt-chk';
      showAll.innerHTML=`<input type="checkbox" ${cur.size===0?'checked':''} style="accent-color:#1473e6;margin-right:8px;width:13px;height:13px;flex-shrink:0">
        <span style="font-style:italic;color:#999">(Show all)</span>`;
      showAll.querySelector('input').addEventListener('change',()=>{setFilter(col,'');renderDropdownItems(search);});
      list.appendChild(showAll);
    }
    filtered.forEach(v=>{
      const lbl=document.createElement('label');
      lbl.className='col-flt-item col-flt-chk'+(cur.has(v)?' selected':'');
      lbl.title=v;
      const escaped=search?search.replace(/[-.*+?^${}()|[\]\\]/g,'\\$&'):'';
      const hl=(search&&escaped)?v.replace(new RegExp('('+escaped+')','gi'),'<mark style="background:#fff3c4;border-radius:2px">$1</mark>'):v;
      lbl.innerHTML=`<input type="checkbox" ${cur.has(v)?'checked':''} style="accent-color:#1473e6;margin-right:8px;width:13px;height:13px;flex-shrink:0">
        <span style="overflow:hidden;text-overflow:ellipsis">${hl}</span>`;
      lbl.querySelector('input').addEventListener('change',()=>{setFilter(col,v);renderDropdownItems(search);});
      list.appendChild(lbl);
    });
    if(!filtered.length){
      const empty=document.createElement('div');
      empty.style.cssText='padding:10px 12px;color:#aaa;font-size:11px;text-align:center;';
      empty.textContent='No matching values';
      list.appendChild(empty);
    }
    const active=filterValues[col];
    const selCount=active&&active.size>0?`${active.size} selected`:'None selected';
    footer.innerHTML='';
    const countSpan=document.createElement('span');
    countSpan.textContent=selCount;
    footer.appendChild(countSpan);
    if(filtered.length>0){
      const selAll=document.createElement('span');
      selAll.style.cssText='color:#1473e6;cursor:pointer;font-weight:500';
      const allSel=filtered.every(v=>(filterValues[col]||new Set()).has(v));
      selAll.textContent=allSel?'Deselect matching':'Select all matching';
      selAll.onclick=()=>{
        if(allSel){filtered.forEach(v=>setFilter(col,v));}
        else{filtered.forEach(v=>{if(!(filterValues[col]||new Set()).has(v))setFilter(col,v);});}
        renderDropdownItems(search);
      };
      footer.appendChild(selAll);
    }
  }

  renderDropdownItems();
  document.body.appendChild(dd);
  _activeFilterDropdown=dd;
  setTimeout(()=>searchInp.focus(),30);

  const ddRect=dd.getBoundingClientRect();
  if(ddRect.bottom>window.innerHeight-20){
    dd.style.top=(rect.top-ddRect.height-2)+'px';
  }

  setTimeout(()=>{
    function outsideClick(e){
      if(!dd.contains(e.target)){closeColFilter();document.removeEventListener('click',outsideClick);}
    }
    document.addEventListener('click',outsideClick);
  },10);
}

function buildGroups(){
  const map={};
  data.forEach((row,i)=>{
    const k=row.__objectPath||'';
    if(!map[k])map[k]=[];
    map[k].push(i);
  });
  const allKeys=Object.keys(map);
  const identityKeys=allKeys.filter(k=>k!==''&&hasIdentity(map[k])).sort((a,b)=>a.localeCompare(b));
  const assignedKeys=allKeys.filter(k=>k!==''&&!hasIdentity(map[k])).sort((a,b)=>a.localeCompare(b));
  const rootKeys=allKeys.filter(k=>k==='');
  const orderedKeys=[...identityKeys,...assignedKeys,...rootKeys];
  return orderedKeys.filter(k=>map[k]&&map[k].length).map(k=>({key:k,indices:map[k]}));
}
