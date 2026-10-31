// ---------- config ----------
const COLORS={waymo:'#1e88ff',tesla:'#e53935',zoox:'#ab47bc','pony.ai':'#26c6a6','baidu apollo go':'#ffb300',weride:'#8bc34a'};
const EXTRA=['#ff7043','#5c6bc0','#ec407a','#9ccc65','#00acc1','#bdbdbd'];
const METRIC_ORDER=['accidents_per_million_driverless_miles','accidents_per_million_driverless_miles_quarterly','crash_reports_count','injury_crashes_per_million_miles','injury_crashes_count','cumulative_driverless_miles','markets_count','geofence_area_sq_mi','cost_per_mile_usd','cost_per_mile_target_usd','cost_per_mile_next_gen_usd','fare_per_mile_usd','fleet_size','paid_rides_per_week','rides_per_quarter','cumulative_rides'];
const TITLES={accidents_per_million_driverless_miles:'Accidents per million driverless miles',cumulative_driverless_miles:'Cumulative fully driverless miles',markets_count:'Number of markets',geofence_area_sq_mi:'Geofence area',cost_per_mile_usd:'Cost per mile (USD)',fare_per_mile_usd:'Fare per mile (USD)',fleet_size:'Fleet size per city / jurisdiction',paid_rides_per_week:'Paid rides per week',
  accidents_per_million_driverless_miles_quarterly:'Crashes per million driverless miles (per quarter)',crash_reports_count:'NHTSA crash reports (count per quarter)',
  injury_crashes_per_million_miles:'Injury crashes per million miles',injury_crashes_count:'Injury crashes (count)',cost_per_mile_target_usd:'Target cost per mile (USD)',
  cost_per_mile_next_gen_usd:'Next-gen vehicle cost per mile (USD)',cumulative_rides:'Cumulative rides',rides_per_quarter:'Rides per quarter',
  other_bets_revenue_usd:'Alphabet Other Bets revenue (USD, quarterly)',other_bets_operating_income_usd:'Alphabet Other Bets operating income (USD, quarterly)',robotaxi_revenue_usd:'Robotaxi revenue (USD)'};
const KEY_METRICS=new Set(['accidents_per_million_driverless_miles','cumulative_driverless_miles','markets_count','geofence_area_sq_mi','cost_per_mile_usd','fare_per_mile_usd','fleet_size','paid_rides_per_week']);
const SHORT={accidents_per_million_driverless_miles:'Accidents / M driverless mi',cumulative_driverless_miles:'Driverless miles (cum.)',markets_count:'Markets',geofence_area_sq_mi:'Geofence',cost_per_mile_usd:'Cost / mile',fare_per_mile_usd:'Fare / mile',fleet_size:'Fleet',paid_rides_per_week:'Paid rides / week'};
const isBench=o=>/^human/i.test(String(o).trim());const BENCH='#9e9e9e';
const BENCH_SHADES=['#9e9e9e','#cfcfcf','#6f6f6f','#b5b5b5'],BENCH_DASH=[[6,4],[2,3],[10,4],[4,2,1,2]];const benchIdx={};
const bIdx=o=>benchIdx[o]??(benchIdx[o]=Object.keys(benchIdx).length);
// Variant keys: overlay on base chart as dashed line, never merged with base values
const VARIANTS={cost_per_mile_allin_usd:{base:'cost_per_mile_usd',label:'all-in'},geofence_area_sq_mi_company_stated:{base:'geofence_area_sq_mi',label:'company-stated'},
  fare_per_mile_usd_cybercab:{base:'fare_per_mile_usd',label:'Cybercab'},fare_per_mile_usd_after_subsidy:{base:'fare_per_mile_usd',label:'after subsidy'},
  paid_rides_per_week_peak:{base:'paid_rides_per_week',label:'peak'},paid_rides_per_week_avg_derived:{base:'paid_rides_per_week',label:'avg, derived'},
  fleet_size_registrations:{base:'fleet_size',label:'registrations',name:(op,mk)=>`${op} ${mk} registrations`}};
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
    meta={updated:raw.generated_at||raw.updated||raw.updated_at||raw.as_of||raw.last_updated||(raw.meta&&(raw.meta.generated_at||raw.meta.updated)),notes:raw.notes||(raw.meta&&raw.meta.notes),sample:raw.is_sample||raw.sample};
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
const title=m=>TITLES[m]||m.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

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
  $('#km').onchange=render;$('#cities').onchange=render;render();
}
const rank=o=>/waymo/i.test(o)?0:/tesla/i.test(o)?1:2;
function vis(){return DATA.rows.filter(r=>!hidden.has(r.operator))}
function render(){renderSummary();renderCharts();renderFleet()}

function renderSummary(){
  const rows=vis(),by={};
  const isA=r=>AGG.has(r.market.toLowerCase()),better=(a,b)=>!b||(isA(a)&&!isA(b))||(isA(a)===isA(b)&&a.date>b.date);
  for(const r of rows){if(!KEY_METRICS.has(r.metric)||isBench(r.operator))continue;
    if(r.metric==='fleet_size'&&!isA(r))continue;const k=r.operator+'|'+r.metric;if(better(r,by[k]))by[k]=r}
  // non-aggregate metrics (e.g. fare) still prefer aggregate; city-only metrics fall back to latest city row
  for(const r of rows){if(!KEY_METRICS.has(r.metric)||isBench(r.operator)||r.metric==='fleet_size')continue}
  // fleet with no company-wide row: show the largest latest jurisdiction (not a sum: jurisdictions can overlap, e.g. Texas ⊃ Austin)
  const fl={};rows.filter(r=>r.metric==='fleet_size'&&!isA(r)&&!isBench(r.operator)).forEach(r=>{const k=r.operator+'|'+r.market;if(!fl[k]||r.date>fl[k].date)fl[k]=r});
  Object.values(fl).forEach(r=>{const k=r.operator+'|fleet_size';if(!by[k]||(!isA(by[k])&&r.value>by[k].value))by[k]=r});
  const ops=[...new Set(rows.map(r=>r.operator).filter(o=>!isBench(o)))].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
  $('#summary').innerHTML=ops.map(o=>{
    const items=Object.values(by).filter(r=>r.operator===o).sort((a,b)=>mi(a.metric)-mi(b.metric));
    let h=items.map(r=>`<div><span>${esc(SHORT[r.metric]||title(r.metric))}${isA(r)?'':' <span class="muted">('+esc(r.market)+')</span>'}</span><b title="${esc(r.source_name)}">${money(r.metric)}${fmt(r.value,r.metric)} ${unitOf(r.metric)} <span class="conf">${esc(r.confidence||r.source_type)}</span><br><span class="muted">${esc(r.date)}</span></b></div>`).join('');
    return `<div class="card" style="--c:${color(o)}"><h3>${esc(o)}</h3>${h||'<span class="muted">no data</span>'}</div>`}).join('');
}
const mi=m=>{const i=METRIC_ORDER.indexOf(m);return i<0?99:i};

function renderCharts(){
  charts.forEach(c=>c.destroy());charts=[];
  const showCities=$('#cities').checked,rows=vis(),metrics=[...new Set(DATA.rows.map(r=>r.chart))].sort((a,b)=>mi(a)-mi(b)||a.localeCompare(b));
  const el=$('#charts');el.innerHTML='';
  for(const m of metrics){
    const all=rows.filter(r=>r.chart===m);
    const hasAgg=new Set(all.filter(r=>AGG.has(r.market.toLowerCase())).map(r=>r.operator+'|'+r.metric));
    const mr=all.filter(r=>showCities||AGG.has(r.market.toLowerCase())||!hasAgg.has(r.operator+'|'+r.metric));
    const groups={};
    for(const r of mr){const agg=AGG.has(r.market.toLowerCase());const V=VARIANTS[r.metric];let k=agg?r.operator:r.operator+' · '+r.market;if(V)k=V.name?V.name(r.operator,r.market):k+' ('+V.label+')';(groups[k]=groups[k]||{op:r.operator,agg,variant:!!V,pts:[]}).pts.push(r)}
    const base0=all.find(r=>!r.variant)||all[0];const unitTxt=unitOf(m)||(base0&&base0.unit&&!/^usd/i.test(base0.unit)?base0.unit:'');
    const box=document.createElement('div');box.className='box';
    box.innerHTML=`<h4>${esc(title(m))}${unitTxt&&!/usd/i.test(title(m))?' <span class="muted">('+esc(unitTxt)+')</span>':''}</h4><div class="cw"><canvas></canvas></div>`;el.appendChild(box);
    if(!mr.length){box.querySelector('.cw').innerHTML='<p class="muted">No data for selected operators</p>';continue}
    const sc=v=>m==='geofence_area_sq_mi'&&km()?v*SQMI_TO_KM2:v;
    const dates=mr.map(r=>Date.parse(r.date)),dmin=Math.min(...dates),dmax=Math.max(...dates);
    const pad=Math.max(45*864e5,(dmax-dmin)*0.05),xmin=dmin-pad,xmax=dmax+pad;
    const ds=[];let i=0;
    for(const [k,g] of Object.entries(groups)){g.pts.sort((a,b)=>a.date<b.date?-1:1);const b=isBench(g.op),col=color(g.op);
      ds.push({label:b?k+' (benchmark)':k,data:g.pts.map(r=>({x:Date.parse(r.date),y:sc(r.value),r})),borderColor:col,backgroundColor:col,
        showLine:g.pts.length>1,borderDash:b?BENCH_DASH[bIdx(g.op)%4]:g.variant?[5,4]:g.agg?[]:[[],[6,3],[2,3],[10,4]][i++%4],
        pointRadius:g.pts.length===1?6:4,pointHoverRadius:8,pointBorderColor:'#0b0f17',pointBorderWidth:1,borderWidth:2,spanGaps:false,tension:0,order:b?2:1,segment:{borderColor:ctx=>ctx.p0.parsed.x===ctx.p1.parsed.x?'transparent':undefined},
        pointStyle:p=>{const c=(p.raw?p.raw.r.confidence+' '+p.raw.r.source_type:'').toLowerCase();return /estimate|\[e\]/.test(c)&&!/derived/.test(c)?'triangle':/derived/.test(c)?'rectRot':'circle'}});
      if(b){const last=g.pts[g.pts.length-1];// reference line at benchmark's latest value, clearly labelled
        ds.push({label:'_ref',data:[{x:xmin,y:sc(last.value)},{x:xmax,y:sc(last.value)}],borderColor:col,borderDash:BENCH_DASH[bIdx(g.op)%4],borderWidth:1.5,pointRadius:0,pointHoverRadius:0,order:3,isRef:true})}}
    const isLog=m==='cumulative_driverless_miles'&&mr.every(r=>r.value>0);
    const c=new Chart(box.querySelector('canvas'),{type:'line',data:{datasets:ds},options:{responsive:true,maintainAspectRatio:false,animation:false,
      interaction:{mode:'nearest',intersect:true},
      scales:{x:{type:'time',min:xmin,max:xmax,ticks:{color:'#7d8a9c',maxRotation:0,autoSkip:true,maxTicksLimit:7},grid:{color:'#1e2636'}},
        y:{type:isLog?'logarithmic':'linear',beginAtZero:!isLog,ticks:{color:'#7d8a9c',maxTicksLimit:7,callback:v=>money(m)+fmt(v)},grid:{color:'#1e2636'}}},
      plugins:{legend:{labels:{color:'#c9d1dc',boxWidth:12,font:{size:11},filter:l=>l.text!=='_ref'}},
        tooltip:{filter:it=>!it.dataset.isRef&&it.raw&&it.raw.r,callbacks:{title:it=>it[0].raw.r.date,label:it=>`${it.dataset.label}: ${money(m)}${fmt(it.raw.r.value,m)} ${unitOf(m)||it.raw.r.unit}`,
          afterLabel:it=>{const r=it.raw.r;return[`Source: ${r.source_name||'—'}`,`Type: ${r.source_type||'—'} · Confidence: ${r.confidence||'—'}`,r.notes?`Note: ${r.notes.length>160?r.notes.slice(0,160)+'…':r.notes}`:'',r.source_url?'(tap again to open source)':''].filter(Boolean)}}}},
      onClick:(e,els)=>{els=els.filter(x=>!c.data.datasets[x.datasetIndex].isRef);if(!els.length)return;const r=c.data.datasets[els[0].datasetIndex].data[els[0].index].r;if(r.source_url&&c._lastTip===r)window.open(r.source_url,'_blank');c._lastTip=r}}});
    charts.push(c);
  }
}

function renderFleet(){
  const latest={};vis().filter(r=>r.metric==='fleet_size'&&!isBench(r.operator)).forEach(r=>{const k=r.operator+'|'+r.market;if(!latest[k]||r.date>latest[k].date)latest[k]=r});
  const mk={};(DATA.markets||[]).forEach(x=>{mk[(x.operator||'')+'|'+(x.market||x.city||'')]=x});
  const list=Object.values(latest).sort((a,b)=>rank(a.operator)-rank(b.operator)||a.operator.localeCompare(b.operator)||b.value-a.value);
  $('#fleet').innerHTML='<tr><th>Operator</th><th>City / market</th><th>Fleet</th><th>Date</th><th>Confidence</th><th>Source</th></tr>'+(list.length?list.map(r=>{const x=mk[r.operator+'|'+r.market]||{};
    return`<tr><td style="color:${color(r.operator)}">${esc(r.operator)}</td><td>${AGG.has(r.market.toLowerCase())?'All markets':esc(r.market)}${x.status?` <span class="muted">${esc(x.status)}</span>`:''}</td><td>${fmt(r.value)}</td><td>${esc(r.date)}</td><td><span class="conf">${esc(r.confidence||r.source_type)}</span></td><td>${r.source_url?`<a href="${esc(r.source_url)}" target="_blank" rel="noopener">${esc(r.source_name||'link')}</a>`:esc(r.source_name)}</td></tr>`}).join(''):'<tr><td colspan="6" class="muted">No per-city fleet data</td></tr>');
}
init();
