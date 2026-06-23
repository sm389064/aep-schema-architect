const XDM_TYPES = ["string","integer","number","boolean","date","date-time","byte","short","long","float","double","object","array","map","geo-shape","geo-point"];

const COLUMNS = [
  { key:"Source Data Column",      renderAs:"text",     defaultVisible:true,  filterable:false, exportable:true },
  { key:"Source Data Type",        renderAs:"text",     defaultVisible:true,  filterable:false, exportable:true },
  { key:"Description",             renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Primary/Secondary Identity", renderAs:"identity", defaultVisible:true, filterable:true, exportable:true },
  { key:"AEP Field Name",          renderAs:"camel",    defaultVisible:true,  filterable:false, exportable:true },
  { key:"AEP Display Name",        renderAs:"text",     defaultVisible:true,  filterable:false, exportable:true },
  { key:"XDM Column Path",         renderAs:"path",     defaultVisible:true,  filterable:false, exportable:true },
  { key:"XDM Data Type",           renderAs:"select",   options:XDM_TYPES, defaultVisible:true, filterable:true, exportable:true },
  { key:"Array",                   renderAs:"array",    defaultVisible:true,  filterable:true,  exportable:true },
  { key:"isRequired",              renderAs:"select",   options:["Yes","No"], defaultVisible:false, filterable:true, exportable:true },
  { key:"Relationship",            renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Field Group Name",        renderAs:"text",     defaultVisible:true,  filterable:true,  exportable:true },
  { key:"Field Group Classification", renderAs:"select", options:["Custom","OOTB"], defaultVisible:true, filterable:true, exportable:true },
  { key:"Modeling",                renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Pre-transformations Required?", renderAs:"text", defaultVisible:false, filterable:false, exportable:true },
  { key:"Transformations Desc",    renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Contract Labels",         renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Identity Labels",         renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Sensitive Labels",        renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Display Name",            renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Component Type",          renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"Attribution Settings",    renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"XDM Script Mixin",        renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
  { key:"XDM Script DULE",         renderAs:"text",     defaultVisible:false, filterable:false, exportable:true },
];

const STD_COLS = COLUMNS.map(c => c.key);
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
const DROPDOWN_FILTER_COLS = new Set(COLUMNS.filter(c => c.filterable).map(c => c.key));
const ORD = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"];
function ordLabel(n){return(ORD[n]||`${n+1}th`);}
