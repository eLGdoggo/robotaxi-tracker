// ---------- config ----------
const COLORS={waymo:'#1e88ff',tesla:'#e53935',zoox:'#ab47bc','pony.ai':'#26c6a6','baidu apollo go':'#ffb300',weride:'#8bc34a'};
const EXTRA=['#ff7043','#5c6bc0','#ec407a','#9ccc65','#00acc1','#bdbdbd'];
const METRIC_ORDER=['accidents_per_million_driverless_miles','accidents_per_million_driverless_miles_quarterly','crash_reports_count','injury_crashes_per_million_miles','injury_crashes_count','cumulative_driverless_miles','markets_count','geofence_area_sq_mi','population_covered','population_covered_published_areas','cost_per_mile_usd','cost_per_mile_target_usd','cost_per_mile_next_gen_usd','fare_per_mile_usd','fleet_size','paid_rides_per_week','rides_per_quarter','cumulative_rides'];
const TITLES={accidents_per_million_driverless_miles:'Accidents per million driverless miles',cumulative_driverless_miles:'Cumulative fully driverless miles',markets_count:'Number of markets',geofence_area_sq_mi:'Geofence area',cost_per_mile_usd:'Cost per mile (USD)',fare_per_mile_usd:'Fare per mile (USD)',fleet_size:'Fleet size',population_covered:'Population covered by service areas',population_covered_published_areas:'Population covered, all published areas',population_covered_supervised:'Population covered, supervised areas',paid_rides_per_week:'Paid rides per week',margin_per_mile_usd:'Margin per mile (fare minus cost), rough estimate',
  accidents_per_million_driverless_miles_quarterly:'Crashes per million driverless miles (per quarter)',crash_reports_count:'NHTSA crash reports (count per quarter)',
  injury_crashes_per_million_miles:'Injury crashes per million miles',injury_crashes_count:'Injury crashes (count)',cost_per_mile_target_usd:'Target cost per mile (USD)',
  cost_per_mile_next_gen_usd:'Next-gen vehicle cost per mile (USD)',cumulative_rides:'Cumulative rides',rides_per_quarter:'Rides per quarter',
  other_bets_revenue_usd:'Alphabet Other Bets revenue (USD, quarterly)',other_bets_operating_income_usd:'Alphabet Other Bets operating income (USD, quarterly)',robotaxi_revenue_usd:'Robotaxi revenue (USD)'};
const KEY_METRICS=new Set(['accidents_per_million_driverless_miles','cumulative_driverless_miles','markets_count','geofence_area_sq_mi','population_covered','population_covered_published_areas','cost_per_mile_usd','fare_per_mile_usd','fleet_size','paid_rides_per_week']);
const SHORT={accidents_per_million_driverless_miles:'Accidents / M driverless mi',cumulative_driverless_miles:'Driverless miles (cum.)',markets_count:'Markets',geofence_area_sq_mi:'Geofence',population_covered:'Population covered',population_covered_published_areas:'Pop., all published areas',cost_per_mile_usd:'Cost / mile',fare_per_mile_usd:'Fare / mile',fleet_size:'Fleet',paid_rides_per_week:'Paid rides / week'};
const isBench=o=>/^human/i.test(String(o).trim());const BENCH='#9e9e9e';
const BENCH_SHADES=['#9e9e9e','#cfcfcf','#6f6f6f','#b5b5b5'],BENCH_DASH=[[6,4],[2,3],[10,4],[4,2,1,2]];const benchIdx={};
const bIdx=o=>benchIdx[o]??(benchIdx[o]=Object.keys(benchIdx).length);
// Variant keys: overlay on base chart as dashed line, never merged with base values
const VARIANTS={cost_per_mile_allin_usd:{base:'cost_per_mile_usd',label:'all-in'},geofence_area_sq_mi_company_stated:{base:'geofence_area_sq_mi',label:'company-stated'},
  fare_per_mile_usd_cybercab:{base:'fare_per_mile_usd',label:'Cybercab'},fare_per_mile_usd_after_subsidy:{base:'fare_per_mile_usd',label:'after subsidy'},
  paid_rides_per_week_peak:{base:'paid_rides_per_week',label:'peak'},paid_rides_per_week_avg_derived:{base:'paid_rides_per_week',label:'avg, derived'},
  fleet_size_third_party_count:{base:'fleet_size',label:'third-party count',name:(op,mk)=>`${op} ${mk} (third-party count)`},
  margin_per_mile_low_usd:{base:'margin_per_mile_usd',label:'low',band:true},margin_per_mile_high_usd:{base:'margin_per_mile_usd',label:'high',band:true},
  fleet_size_registrations:{base:'fleet_size',label:'registrations',name:(op,mk)=>`${op} ${mk} registrations`},
  population_covered_published_areas:{base:'population_covered',label:'all published areas'},population_covered_supervised:{base:'population_covered',label:'supervised'}};
// One-line explanations shown under a chart title (by metric key and mode)
const NOTES={'population_covered|compare':'Residents inside fully public service areas (no waitlist, no safety monitor), per robotracker.app. Tesla counts Austin only so far.',
  'population_covered_published_areas|compare':'Sum of every published service area per company, incl. invite-only and early-rider areas (2020 Census, Robotaxi Tracker). Tracked from Sep 2026.',
  'population_covered|detail':'Residents inside each city\u2019s service area (US: 2020 Census blocks via Robotaxi Tracker; China: company statements).'};
// Snapshot metrics: value holds until the next recorded change, so draw as steps
const STEPPED=new Set(['population_covered','population_covered_published_areas']);
// Detail charts drawn as latest-value bars per city (one snapshot per city reads better than many single points)
const BAR_DETAIL=new Set(['population_covered']);
const AGG=new Set(['','all','total','global','overall','aggregate','company','worldwide','*']);
const SQMI_TO_KM2=2.58999;

// ---------- loader (ONLY place that knows data.json's shape) ----------
// Accepts: an array of rows; {metrics|rows|data|observations|records:[...]};
// columnar {date:[...],operator:[...],...}; or {operators:{Waymo:{metric:[{date,value,...}]}}}.
// Optional: markets|markets_info array, generated_at|updated|as_of, notes.
function normKey(k){return String(k).trim().toLowerCase().replace(/[\s\-]+/g,'_')}
function normMetric(m){
  m=normKey(m||'');if(VARIANTS[m])return m;
  const al={accidents_per_million_miles:'accidents_per_million_driverless_miles',accidents_per_mm:'accidents_per_million_driverless_miles',
    cumulative_miles:'cumulative_driverless_miles',driverless_miles_cumulative:'cumulative_driverless_miles',
    markets:'markets_count',number_of_markets:'markets_count',num_markets:'markets_count',
    geofence_sq_mi:'geofence_area_sq_mi',geofence_area:'geofence_area_sq_mi',
    cost_per_mile:'cost_per_mile_usd',fare_per_mile:'fare_per_mile_usd',fleet:'fleet_size',vehicles:'fleet_size'};
  return al[m]||m;
}
function loadData(raw){
  let rows=[],markets=[],meta={};
  const toRows=a=>a.map(r=>{const o={};for(const k in r)o[normKey(k)]=r[k];return o});
  if(Array.isArray(raw)) rows=toRows(raw);
  else if(raw&&typeof raw==='object'){
    const key=['metrics','rows','data','observations','records','series'].find(k=>raw[k]!=null);
    let v=key?raw[key]:null;
    if(Array.isArray(v)) rows=toRows(v);
    else if(v&&typeof v==='object'&&Array.isArray(v.date)){ // columnar
      rows=v.date.map((_,i)=>{const o={};for(const k in v)o[normKey(k)]=v[k][i];return o});
    } else if(Array.isArray(raw.date)){ rows=raw.date.map((_,i)=>{const o={};for(const k in raw)if(Array.isArray(raw[k]))o[normKey(k)]=raw[k][i];return o}); }
    const opsObj=raw.operators&&!Array.isArray(raw.operators)?raw.operators:null;
    if(!rows.length&&opsObj){for(const op in opsObj)for(const m in opsObj[op])for(const p of [].concat(opsObj[op][m]))rows.push({operator:op,metric:m,...toRows([p])[0]})}
    markets=toRows(raw.markets||raw.markets_info||raw.market_list||[]);
    meta={chartConfig:raw.chart_config&&typeof raw.chart_config==='object'?raw.chart_config:null,updated:raw.generated_at||raw.updated||raw.updated_at||raw.as_of||raw.last_updated||(raw.meta&&(raw.meta.generated_at||raw.meta.updated)),notes:raw.notes||(raw.meta&&raw.meta.notes),sample:raw.is_sample||raw.sample};
  }
  rows=rows.map(r=>({date:r.date||r.as_of||r.period,operator:String(r.operator||r.company||'').trim(),market:String(r.market??r.city??r.jurisdiction??'').trim(),
    metric:normMetric(r.metric||r.measure),value:r.value===''||r.value==null?null:Number(String(r.value).replace(/,/g,'')),unit:r.unit||'',
    source_type:r.source_type||'',confidence:r.confidence||'',source_name:r.source_name||r.source||'',source_url:r.source_url||r.url||'',notes:r.notes||''}))
    .filter(r=>r.operator&&r.metric&&r.date&&r.value!=null&&isFinite(r.value)&&!isNaN(Date.parse(r.date)));
  rows.forEach(r=>{if(/_human_benchmark$/.test(r.metric)){r.metric=r.metric.replace(/_human_benchmark$/,'');r.operator='Human benchmark'}});
  // geofence in km² -> store as sq mi
  rows.forEach(r=>{if(r.metric==='geofence_area_km2'||(r.metric==='geofence_area_sq_mi'&&/km/i.test(r.unit))){r.metric='geofence_area_sq_mi';r.value/=SQMI_TO_KM2;r.unit='sq mi'}});
  rows.forEach(r=>{const v=VARIANTS[r.metric];r.chart=v?v.base:r.metric;r.variant=v?v.label:''});
  return {rows,markets,meta};
}

// ---------- state ----------
let DATA,charts=[],hidden=new Set(),colorMap={};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function color(op){if(isBench(op))return BENCH_SHADES[bIdx(op)%BENCH_SHADES.length];const k=op.toLowerCase();if(COLORS[k])return COLORS[k];if(/waymo/.test(k))return COLORS.waymo;if(/tesla/.test(k))return COLORS.tesla;if(/baidu|apollo/.test(k))return COLORS['baidu apollo go'];if(/pony/.test(k))return COLORS['pony.ai'];
  return colorMap[k]||(colorMap[k]=EXTRA[Object.keys(colorMap).length%EXTRA.length])}
const km=()=>$('#km').checked;
function fmt(v,m){if(m==='geofence_area_sq_mi'&&km())v*=SQMI_TO_KM2;const a=Math.abs(v);
  if(a>=1e9)return(v/1e9).toFixed(2)+'B';if(a>=1e6)return(v/1e6).toFixed(a>=1e8?0:1)+'M';if(a>=1e4)return(v/1e3).toFixed(0)+'k';
  return a<10&&v%1?v.toFixed(2).replace(/0$/,''):Math.round(v*10)/10+''}
const money=m=>/_usd$/.test(m)?'$':'';
const unitOf=m=>m==='geofence_area_sq_mi'?(km()?'km²':'sq mi'):'';
const title=m=>TITLES[m]||(VARIANTS[m]?title(VARIANTS[m].base)+', '+VARIANTS[m].label:null)||m.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

async function fetchFirst(){
  const q=new URLSearchParams(location.search).get('data');
  const paths=q?[q]:['../data/data.json','data.json'];
  for(const p of paths){try{const r=await fetch(p,{cache:'no-store'});if(r.ok)return{raw:await r.json(),path:p}}catch(e){}}
  throw new Error('No data.json found (tried '+paths.join(', ')+')');
}
async function init(){
  try{const {raw,path}=await fetchFirst();DATA=loadData(raw);DATA.path=path}
  catch(e){$('#banner').style.display='block';$('#banner').textContent=e.message+'. Data is still being prepared.';return}
  if(/dev-sample/.test(DATA.path)||DATA.meta.sample){$('#banner').style.display='block';$('#banner').textContent='⚠ DEV SAMPLE: fake placeholder numbers, not real data.'}
  $('#meta').textContent=`${DATA.rows.length} data points · ${DATA.path}`+(DATA.meta.updated?` · updated ${DATA.meta.updated}`:'');
  const ops=[...new Set(DATA.rows.map(r=>r.operator).filter(o=>!isBench(o)))].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
  $('#ops').innerHTML=ops.map(o=>`<button class="chip on" style="--c:${color(o)}" data-op="${esc(o)}">${esc(o)}</button>`).join('');
  $('#ops').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;const o=b.dataset.op;hidden.has(o)?hidden.delete(o):hidden.add(o);b.classList.toggle('on');render()};
  $('#km').onchange=render;render();
}
const rank=o=>/waymo/i.test(o)?0:/tesla/i.test(o)?1:2;
function vis(){return DATA.rows.filter(r=>!hidden.has(r.operator))}

// ---------- layout ----------
const isA=r=>AGG.has(r.market.toLowerCase());
const MARGIN='margin_per_mile_usd';
function hexToHsl(h){let r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let H=0,S=0,L=(mx+mn)/2;
  if(mx!==mn){const d=mx-mn;S=L>.5?d/(2-mx-mn):d/(mx+mn);H=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;H*=60}return[H,S*100,L*100]}
function shade(hex,i,n){if(n<=1||i===0)return hex;const[h,s,l]=hexToHsl(hex);const L=[l,l+18,l-14,l+30,l-24,l+9,l-7][i%7];return`hsl(${h.toFixed(0)},${s.toFixed(0)}%,${Math.max(22,Math.min(85,L)).toFixed(0)}%)`}

// Decide charts.
// chart_config (preferred): LIST of {metric, group:'compare'|'breakdown:<operator>', series:[operators|markets], max_points_per_series, publish}
// (a map {metric:{group,publish,series}} is also accepted). One chart per published entry. Without config: computed rule.
const HIDE_UNLESS_CONFIG=new Set(['fare_per_mile_realised_usd']);
function cfgList(){const c=DATA.meta.chartConfig;if(!c)return null;
  if(Array.isArray(c))return c.filter(e=>e&&e.metric);
  return Object.entries(c).flatMap(([k,v])=>[].concat(v).map(e=>({metric:k,...e})))}
function plan(rows){
  const cfg=cfgList();
  const ops=[...new Set(rows.map(r=>r.operator).filter(o=>!isBench(o)))].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
  const compare=[],detail={};let margin=[];
  const benchFor=(k,mk)=>rows.filter(r=>r.metric===k&&isBench(r.operator)&&mk.has(r.market));
  const addDetail=(o,k,or)=>{if(or.length<(BAR_DETAIL.has(k)?1:2))return;const mk=new Set(or.map(r=>r.market));(detail[o]=detail[o]||[]).push({key:k,rows:or.concat(benchFor(k,mk))})};
  const covered=new Set();
  if(cfg){
    for(const e of cfg){covered.add(e.metric);if(e.publish===false||!e.publish&&e.publish!==undefined)continue;
      const g=String(e.group||'compare'),ser=Array.isArray(e.series)?new Set(e.series):null;
      if(/^margin_per_mile_(low|high)_usd$/.test(e.metric))continue;
      if(e.metric===MARGIN){margin=rows.filter(r=>r.chart===MARGIN&&isA(r)&&(!ser||ser.has(r.operator)));continue}
      if(g==='compare'){const cr=rows.filter(r=>r.metric===e.metric&&isA(r)&&(!ser||ser.has(r.operator)||isBench(r.operator)));if(cr.length>1)compare.push({key:e.metric,rows:cr})}
      else if(g.startsWith('breakdown:')){const o=g.slice(10);addDetail(o,e.metric,rows.filter(r=>r.metric===e.metric&&r.operator===o&&(!ser||ser.has(r.market)||(isA(r)&&ser.has('all')))))}
    }
  }
  // fallback for metrics not covered by config (or no config at all)
  const charts=[...new Set(rows.filter(r=>!covered.has(r.metric)&&!(VARIANTS[r.metric]&&covered.has(VARIANTS[r.metric].base))&&!(cfg===null?false:false)).map(r=>r.chart))]
    .filter(k=>!HIDE_UNLESS_CONFIG.has(k)).sort((a,b)=>mi(a)-mi(b)||a.localeCompare(b));
  for(const k of charts){
    if(k===MARGIN){margin=rows.filter(r=>r.chart===MARGIN&&isA(r));continue}
    const cr=rows.filter(r=>r.metric===k&&isA(r)),co=cr.filter(r=>!isBench(r.operator));
    const isCmp=new Set(co.map(r=>r.operator)).size>=2&&co.length>1;
    if(isCmp)compare.push({key:k,rows:cr});
    for(const o of ops){const or=rows.filter(r=>r.chart===k&&r.operator===o&&!covered.has(r.metric));
      if(or.some(r=>!isA(r)||r.variant)||!isCmp)addDetail(o,k,or)}
  }
  compare.sort((a,b)=>mi(a.key)-mi(b.key));
  for(const o in detail)detail[o].sort((a,b)=>mi(a.key)-mi(b.key)||a.key.localeCompare(b.key));
  const dOps=ops.concat(Object.keys(detail).filter(o=>!ops.includes(o)));
  return{compare,detail,ops:dOps,margin:margin.filter(r=>r.metric===MARGIN).length>1?margin:[]};
}

function render(){
  charts.forEach(c=>c.destroy());charts=[];
  const P=plan(vis());
  renderSummary();
  const m=$('#margin');m.innerHTML='';if(P.margin.length)drawChart(m,MARGIN,P.margin,'margin');
  const c=$('#compare');c.innerHTML='';P.compare.forEach(x=>drawChart(c,x.key,x.rows,'compare'));
  if(!P.compare.length)c.innerHTML='<p class="muted">Not enough company-wide data to compare.</p>';
  const d=$('#detail');d.innerHTML='';
  for(const o of P.ops){if(!P.detail[o])continue;const sec=document.createElement('div');
    sec.innerHTML=`<h3 class="coh" style="--c:${color(o)}">${esc(o)}</h3><div class="grid"></div>`;d.appendChild(sec);
    P.detail[o].forEach(x=>(BAR_DETAIL.has(x.key)?drawBars:drawChart)(sec.querySelector('.grid'),x.key,x.rows,'detail',o))}
  renderFleet();
}

function renderSummary(){
  const by={};
  for(const r of vis()){if(!KEY_METRICS.has(r.metric)||isBench(r.operator)||!isA(r))continue;const k=r.operator+'|'+r.metric;if(!by[k]||r.date>by[k].date)by[k]=r}
  const ops=[...new Set(vis().map(r=>r.operator).filter(o=>!isBench(o)))].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
  $('#summary').innerHTML=ops.map(o=>{
    const items=Object.values(by).filter(r=>r.operator===o).sort((a,b)=>mi(a.metric)-mi(b.metric));
    const h=items.map(r=>`<div><span>${esc(SHORT[r.metric]||title(r.metric))}</span><b title="${esc(r.source_name)}">${money(r.metric)}${fmt(r.value,r.metric)} ${unitOf(r.metric)} <span class="conf">${esc(r.confidence||r.source_type)}</span><br><span class="muted">${esc(r.date)}</span></b></div>`).join('');
    return `<div class="card" style="--c:${color(o)}"><h3>${esc(o)}</h3>${h||'<span class="muted">no company-wide data</span>'}</div>`}).join('');
}
const mi=m=>{const i=METRIC_ORDER.indexOf(m);return i<0?99:i};

function drawChart(el,m,rows,mode,op){
  const groups={};
  for(const r of rows){const V=VARIANTS[r.metric],b=isBench(r.operator);
    let k;if(mode==='compare'||(mode==='margin'&&!V))k=r.operator;
    else if(V&&V.band)k=r.operator+'|band'+V.label;
    else{k=isA(r)?r.operator:r.operator+' · '+r.market;if(V)k=V.name?V.name(r.operator,r.market):k+' ('+V.label+')'}
    (groups[k]=groups[k]||{op:r.operator,market:r.market,agg:isA(r),variant:V,bench:b,pts:[]}).pts.push(r)}
  const base0=rows.find(r=>!r.variant)||rows[0];const unitTxt=unitOf(m)||(base0&&base0.unit&&!/^usd/i.test(base0.unit)?base0.unit:'');
  const box=document.createElement('div');box.className='box'+(mode==='margin'?' wide':'');
  const sub=NOTES[m+'|'+mode]?`<div class="muted">${esc(NOTES[m+'|'+mode])}</div>`:mode==='margin'?'<div class="muted">Rough estimate: list fares minus analyst cost estimates; Waymo&#39;s realised revenue (~$4.75/mi) implies a lower margin. Shaded band = low–high cost-estimate range.</div>':'';
  box.innerHTML=`<h4>${esc(title(m))}${unitTxt&&!/usd/i.test(title(m))?' <span class="muted">('+esc(unitTxt)+')</span>':''}</h4>${sub}<div class="cw"><canvas></canvas></div>`;el.appendChild(box);
  const sc=v=>m==='geofence_area_sq_mi'&&km()?v*SQMI_TO_KM2:v;
  const dates=rows.map(r=>Date.parse(r.date)),dmin=Math.min(...dates),dmax=Math.max(...dates);
  const pad=Math.max(45*864e5,(dmax-dmin)*0.05),xmin=dmin-pad,xmax=dmax+pad;
  // city shade index per operator
  const cityIdx={};Object.values(groups).filter(g=>!g.bench&&g.agg).forEach(g=>{cityIdx[g.op]=cityIdx[g.op]||[g.market]});Object.values(groups).filter(g=>!g.bench&&!g.variant).forEach(g=>{const l=cityIdx[g.op]=cityIdx[g.op]||[];if(!l.includes(g.market))l.push(g.market)});
  Object.values(groups).filter(g=>!g.bench).forEach(g=>{const l=cityIdx[g.op]=cityIdx[g.op]||[];if(!l.includes(g.market))l.push(g.market)});
  const ds=[];
  const entries=Object.entries(groups).sort((a,b)=>(a[1].bench-b[1].bench)||(!!a[1].variant-!!b[1].variant)||(b[1].agg-a[1].agg));
  for(const [k,g] of entries){g.pts.sort((a,b)=>a.date<b.date?-1:1);const b=g.bench;
    const l=cityIdx[g.op]||[g.market];const col=b?color(g.op):shade(color(g.op),l.indexOf(g.market),l.length);
    const data=g.pts.map(r=>({x:Date.parse(r.date),y:sc(r.value),r}));
    if(g.variant&&g.variant.band){const hi=g.variant.label==='high';
      ds.push({label:hi?'_bandhi_'+g.op:'_bandlo_'+g.op,data,borderColor:'transparent',backgroundColor:color(g.op)+'33',pointRadius:0,pointHoverRadius:4,showLine:true,fill:hi?'-1':false,order:5,band:true,spanGaps:false});continue}
    ds.push({label:b?k+' (benchmark)':k,data,borderColor:col,backgroundColor:col,
      showLine:g.pts.length>1,stepped:STEPPED.has(m)?'after':false,borderDash:b?BENCH_DASH[bIdx(g.op)%4]:g.variant?[5,4]:[],
      pointRadius:g.pts.length===1?6:4,pointHoverRadius:8,pointBorderColor:'#0b0f17',pointBorderWidth:1,borderWidth:g.agg&&!g.variant?2.5:2,spanGaps:false,tension:0,order:b?2:1,
      segment:{borderColor:ctx=>ctx.p0.parsed.x===ctx.p1.parsed.x?'transparent':undefined},
      pointStyle:p=>{const c=(p.raw?p.raw.r.confidence+' '+p.raw.r.source_type:'').toLowerCase();return /estimate|\[e\]/.test(c)&&!/derived/.test(c)?'triangle':/derived/.test(c)?'rectRot':'circle'}});
    if(b){const last=g.pts[g.pts.length-1];
      ds.push({label:'_ref',data:[{x:xmin,y:sc(last.value)},{x:xmax,y:sc(last.value)}],borderColor:col,borderDash:BENCH_DASH[bIdx(g.op)%4],borderWidth:1.5,pointRadius:0,pointHoverRadius:0,order:3,isRef:true})}}
  // band datasets must be adjacent lo then hi for fill:'-1'
  {const bands=ds.filter(d=>d.band).sort((a,b)=>{const oa=a.label.slice(9),ob=b.label.slice(9);return oa<ob?-1:oa>ob?1:(a.label.includes('lo')?-1:1)});const rest=ds.filter(d=>!d.band);ds.length=0;ds.push(...rest,...bands)}
  const isLog=m==='cumulative_driverless_miles'&&rows.every(r=>r.value>0)&&Math.max(...rows.map(r=>r.value))/Math.min(...rows.map(r=>r.value))>50;
  const c=new Chart(box.querySelector('canvas'),{type:'line',data:{datasets:ds},options:{responsive:true,maintainAspectRatio:false,animation:false,
    interaction:{mode:'nearest',intersect:true},
    scales:{x:{type:'time',min:xmin,max:xmax,ticks:{color:'#7d8a9c',maxRotation:0,autoSkip:true,maxTicksLimit:7},grid:{color:'#1e2636'}},
      y:{type:isLog?'logarithmic':'linear',beginAtZero:!isLog,ticks:{color:'#7d8a9c',maxTicksLimit:7,callback:v=>money(m)+fmt(v)},
        grid:{color:ctx=>ctx.tick&&ctx.tick.value===0&&mode==='margin'?'#c9d1dc':'#1e2636',lineWidth:ctx=>ctx.tick&&ctx.tick.value===0&&mode==='margin'?1.5:1}}},
    plugins:{legend:{labels:{color:'#c9d1dc',boxWidth:12,font:{size:11},filter:l=>!/^_/.test(l.text)}},
      tooltip:{filter:it=>!it.dataset.isRef&&it.raw&&it.raw.r,callbacks:{title:it=>it[0].raw.r.date,
        label:it=>`${it.dataset.band?it.raw.r.operator+' '+VARIANTS[it.raw.r.metric].label:it.dataset.label}: ${money(m)}${fmt(it.raw.r.value,m)} ${unitOf(m)||it.raw.r.unit}`,
        afterLabel:it=>{const r=it.raw.r;return[`Source: ${r.source_name||'—'}`,`Type: ${r.source_type||'—'} · Confidence: ${r.confidence||'—'}`,r.notes?`Note: ${r.notes.length>160?r.notes.slice(0,160)+'…':r.notes}`:'',r.source_url?'(tap again to open source)':''].filter(Boolean)}}}},
    onClick:(e,els)=>{els=els.filter(x=>!c.data.datasets[x.datasetIndex].isRef);if(!els.length)return;const r=c.data.datasets[els[0].datasetIndex].data[els[0].index].r;if(r&&r.source_url&&c._lastTip===r)window.open(r.source_url,'_blank');c._lastTip=r}}});
  charts.push(c);
}

// Latest value per city as horizontal bars (detail mode). Earlier dated values are listed in the tooltip.
function drawBars(el,m,rows,mode,op){
  const by={};rows.filter(r=>!r.variant&&!isBench(r.operator)).forEach(r=>{const k=isA(r)?'All markets':r.market;(by[k]=by[k]||[]).push(r)});
  const items=Object.entries(by).map(([k,a])=>{a.sort((x,y)=>x.date<y.date?-1:1);return{k,r:a[a.length-1],hist:a}}).sort((a,b)=>b.r.value-a.r.value);
  if(!items.length)return;
  const box=document.createElement('div');box.className='box';box.style.height=Math.max(220,110+items.length*30)+'px';
  const n=NOTES[m+'|'+mode];
  box.innerHTML=`<h4>${esc(title(m))} <span class="muted">(latest, people)</span></h4>${n?`<div class="muted">${esc(n)}</div>`:''}<div class="cw"><canvas></canvas></div>`;el.appendChild(box);
  const col=color(op);
  const c=new Chart(box.querySelector('canvas'),{type:'bar',data:{labels:items.map(i=>i.k),datasets:[{label:op,data:items.map(i=>i.r.value),
      backgroundColor:items.map(i=>/estimate|\[e\]/i.test(i.r.confidence)?col+'b3':col),borderColor:col,borderWidth:1,borderRadius:3,maxBarThickness:22}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,
      scales:{x:{beginAtZero:true,ticks:{color:'#7d8a9c',maxTicksLimit:6,callback:v=>fmt(v)},grid:{color:'#1e2636'}},y:{ticks:{color:'#c9d1dc',font:{size:11},autoSkip:false},grid:{display:false}}},
      plugins:{legend:{display:false},tooltip:{callbacks:{title:it=>items[it[0].dataIndex].k,
        label:it=>{const i=items[it.dataIndex];return `${fmt(i.r.value)} people (${i.r.date})`},
        afterLabel:it=>{const i=items[it.dataIndex],r=i.r;return[i.hist.length>1?'Earlier: '+i.hist.slice(0,-1).map(h=>`${h.date} ${fmt(h.value)}`).join(', '):'',`Source: ${r.source_name||'—'}`,`Type: ${r.source_type||'—'} · Confidence: ${r.confidence||'—'}`,r.notes?`Note: ${r.notes.length>160?r.notes.slice(0,160)+'…':r.notes}`:'',r.source_url?'(tap again to open source)':''].filter(Boolean)}}}},
      onClick:(e,els)=>{if(!els.length)return;const r=items[els[0].index].r;if(r.source_url&&c._lastTip===r)window.open(r.source_url,'_blank');c._lastTip=r}}});
  charts.push(c);
}

function renderFleet(){
  const latest={};vis().filter(r=>r.metric==='fleet_size'&&!isBench(r.operator)).forEach(r=>{const k=r.operator+'|'+r.market;if(!latest[k]||r.date>latest[k].date)latest[k]=r});
  const mk={};(DATA.markets||[]).forEach(x=>{mk[(x.operator||'')+'|'+(x.market||x.city||'')]=x});
  const pop={};DATA.rows.filter(r=>r.metric==='population_covered'||r.metric==='population_covered_published_areas').forEach(r=>{const k=r.operator+'|'+(isA(r)?'all':r.market)+'|'+r.metric;if(!pop[k]||r.date>pop[k].date)pop[k]=r});
  const popOf=r=>{const m=isA(r)?'all':r.market;const P=pop[r.operator+'|'+m+'|population_covered'],V=pop[r.operator+'|'+m+'|population_covered_published_areas'];const p=m==='all'?(V||P):(P||V); // company rows: all published areas, matching fleet totals across all cities
    return p?`<span title="${esc((p.source_name||'')+' · '+p.date+(p.variant?' · '+p.variant:''))}">${fmt(p.value)}${p.variant?'*':''}</span>`:'<span class="muted">—</span>'};
  const list=Object.values(latest).sort((a,b)=>rank(a.operator)-rank(b.operator)||a.operator.localeCompare(b.operator)||b.value-a.value);
  $('#fleet').innerHTML='<tr><th>Operator</th><th>City / market</th><th>Fleet</th><th>Population covered</th><th>Date</th><th>Confidence</th><th>Source</th></tr>'+(list.length?list.map(r=>{const x=mk[r.operator+'|'+r.market]||{};
    return`<tr><td style="color:${color(r.operator)}">${esc(r.operator)}</td><td>${isA(r)?'All markets':esc(r.market)}${x.status?` <span class="muted">${esc(x.status)}</span>`:''}</td><td>${fmt(r.value)}</td><td>${popOf(r)}</td><td>${esc(r.date)}</td><td><span class="conf">${esc(r.confidence||r.source_type)}</span></td><td>${r.source_url?`<a href="${esc(r.source_url)}" target="_blank" rel="noopener">${esc(r.source_name||'link')}</a>`:esc(r.source_name)}</td></tr>`}).join(''):'<tr><td colspan="7" class="muted">No fleet data</td></tr>');
}
init();
