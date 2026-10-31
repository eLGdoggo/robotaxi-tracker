import pandas as pd, json, csv, ast, os
R='/workspace/robotaxi-tracker/data/raw/'; O='/workspace/robotaxi-tracker/data/'
rows=[]
def add(date,op,mkt,metric,val,unit,stype,conf,sname,url,notes=''):
    rows.append(dict(date=date,operator=op,market=mkt,metric=metric,value=float(val),unit=unit,source_type=stype,confidence=conf,source_name=sname,source_url=url,notes=notes))
SGO='https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADS.csv'
SGOA='https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/Archive-2021-2025/SGO-2021-01_Incident_Reports_ADS.csv'
HUB='https://waymo.com/safety/impact/'
HUB2='https://storage.googleapis.com/waymo-uploads/files/documents/safety/safety-impact-data/CSV2%20-%20Crashes%20with%20SGO%20ID%20and%20Group%20Membership%20202009-202606-2022benchmark.csv'
RTS='https://www.robotaxistats.com/sources/waymo-safety-hub/'
RTT='https://www.robotaxistats.com/services/tesla/'
RTL='https://robotracker.app/leaderboard'
WH='https://support.google.com/waymo/announcements/12766613?hl=en'
# ---- 1. SGO crash report counts per quarter (raw)
a=pd.read_csv(R+'archive.csv',low_memory=False); n=pd.read_csv(R+'SGO-2021-01_Incident_Reports_ADS.csv',low_memory=False)
d=pd.concat([a,n]).sort_values('Report Version').drop_duplicates('Report ID',keep='last')
d['dt']=pd.to_datetime(d['Incident Date'],format='%b-%Y',errors='coerce')
ent={'Waymo LLC':'Waymo','Tesla, Inc.':'Tesla','Zoox, Inc.':'Zoox'}
d=d[d['Reporting Entity'].isin(ent)].copy(); d['op']=d['Reporting Entity'].map(ent)
d['q']=d.dt.dt.to_period('Q')
for (op,q),c in d.groupby(['op','q']).size().items():
    note='NHTSA SGO ADS incident reports by incident month, deduped to latest version. Includes ALL ADS operation (Waymo/Zoox include testing with safety drivers; Tesla includes Jun 2025-Jan 2026 rides with a safety monitor in passenger seat). Not normalised by miles.'
    if str(q)=='2026Q3': note+=' Latest quarter likely incomplete (reporting lag; file through Sep 2026).'
    add(q.end_time.strftime('%Y-%m-%d'),op,'all','crash_reports_count',c,'reports/quarter','regulator','reported','NHTSA SGO 2021-01 ADS incident reports',SGOA if q.year<2025 or (q.year==2025 and q.quarter<=2) else SGO,note)
# ---- 2. Waymo rider-only cumulative miles (hub releases)
wm={'2024-06-30':22.2,'2024-07-31':25.3,'2024-09-30':33.1,'2024-12-31':50.1,'2025-03-31':71.6,'2025-06-30':96.0,'2025-09-30':127.2,'2025-12-31':170.7,'2026-03-31':220.6,'2026-06-30':271.3}
for k,v in wm.items():
    add(k,'Waymo','all','cumulative_driverless_miles',v*1e6,'miles','company','company-stated','Waymo Safety Impact hub (via robotaxistats release table)',HUB if k=='2026-06-30' else RTS,'Rider-only (no human driver) miles, ride-hail cities. Pre-Dec-2025 values are sums of location rows; coverage varies by release.')
add('2023-10-31','Waymo','all','cumulative_driverless_miles',7.1e6,'miles','company','company-stated','Kusano et al. 2024 (7.1M RO miles), cited on Waymo hub',HUB,'Peer-reviewed paper; through Oct 2023.')
add('2026-02-12','Waymo','all','cumulative_driverless_miles',200e6,'miles','company','company-stated','Waymo blog (nearly 200M fully autonomous miles)','https://waymo.com/blog/2026/02/ro-on-6th-gen-waymo-driver/','"nearly"; fully autonomous public-road miles.')
c1=pd.read_csv(R+'w_csv1.csv')
for _,r in c1.iterrows():
    nm=r['County Name']
    if nm in ('Phoenix','Maricopa'): m='Phoenix'
    elif nm=='San Francisco Bay Area': m='San Francisco Bay Area'
    elif nm=='Los Angeles': m='Los Angeles'
    elif nm=='Travis': m='Austin'
    elif nm=='Atlanta Area': m='Atlanta'
    else: continue
    add('2026-06-30','Waymo',m,'cumulative_driverless_miles',r['Waymo RO Miles (Millions)']*1e6,'miles','company','company-stated','Waymo Safety Impact hub CSV1',HUB,'Rider-only miles through Jun 2026 by location.')
# Tesla
TS='Tesla Robotaxi Safety Report (via robotaxistats)'
tnote='Tesla unsupervised miles: no employee in driver or passenger seat, from 22 Jan 2026. Excludes Jun 2025-Jan 2026 rides with passenger-seat safety monitor, Bay Area safety-driver rides and FSD Supervised. Tesla does not state whether chase cars/remote ops were used on all miles.'
add('2026-10-18','Tesla','all','cumulative_driverless_miles',3.1e6,'miles','company','company-stated',TS,RTT,tnote)
for m,v in {'Austin':2118015,'Dallas':608130,'Houston':225964,'Miami':46262,'Orlando':61053,'Tampa':53117}.items():
    add('2026-10-18','Tesla',m,'cumulative_driverless_miles',v,'miles','company','company-stated',TS,RTT,tnote)
add('2026-10-28','Tesla','all','cumulative_driverless_miles',3.8e6,'miles','media','company-stated','CNBC citing Tesla website counter','https://www.cnbc.com/2026/10/28/as-waymo-expands-overseas-it-remains-a-niche-cash-burning-business.html','Live counter is an estimate at current pace, not a confirmed tally.')
for dt,km,u in [('2026-03-31',220e6,'https://www.prnewswire.com/news-releases/baidu-announces-first-quarter-2026-results-302774476.html'),('2026-08-18',240e6,'https://www.sec.gov/Archives/edgar/data/1329099/000119312526355431/d112854dex991.htm')]:
    add(dt,'Baidu Apollo Go','all','cumulative_driverless_miles',round(km/1.609344),'miles','company','derived [E]','Baidu results release',u,f'Company stated ">{km/1e6:.0f}M fully driverless km"; converted at 1.609344 km/mi. Lower bound. Global incl. tests.')
# ---- 3. Accident rates
w2=pd.read_csv(R+'w_csv2.csv'); w2['ym']=w2['Year Month'].astype(int)
w2=w2[w2['Is NHTSA Reportable In-Transport']==True]
ends=sorted(wm)
for k in ends:
    ym=int(k[:4]+k[5:7]); c=(w2.ym<=ym).sum()
    add(k,'Waymo','all','accidents_per_million_driverless_miles',round(c/wm[k],3),'crashes per M mi (cumulative)','derived','derived [E]','Waymo hub CSV2 (Jun-2026 release) crash list / hub RO miles',HUB2,f'Cumulative in-transport RO crashes (any severity, any fault) {c} / {wm[k]}M RO miles. Crash list from latest release applied to earlier mileage totals; mileage coverage varied by release.')
for i in range(1,len(ends)):
    a0,a1=ends[i-1],ends[i]
    if a0[5:7] not in('03','06','09','12') or a1[5:7] not in('03','06','09','12'): continue
    y0,y1=int(a0[:4]+a0[5:7]),int(a1[:4]+a1[5:7]); c=((w2.ym>y0)&(w2.ym<=y1)).sum(); mi=wm[a1]-wm[a0]
    add(a1,'Waymo','all','accidents_per_million_driverless_miles_quarterly',round(c/mi,3),'crashes per M mi (in period)','derived','derived [E]','Waymo hub CSV2 / hub RO miles',HUB2,f'{c} in-transport RO crashes / {mi:.1f}M RO miles in period {a0}..{a1}.')
add('2026-06-30','Waymo','all','injury_crashes_per_million_miles',0.67,'crashes per M mi','company','company-stated','Waymo Safety Impact hub',HUB,'Any-injury-reported crashes, RO, all locations through Jun 2026.')
add('2026-06-30','Waymo','all','injury_crashes_per_million_miles_human_benchmark',3.77,'crashes per M mi','company','company-stated','Waymo Safety Impact hub',HUB,'Human benchmark same areas, 32% underreporting adjustment.')
t=d[(d.op=='Tesla')&(d.dt>='2026-02-01')&(d.dt<='2026-09-30')]
add('2026-09-30','Tesla','all','accidents_per_million_driverless_miles',round(len(t)/3.1,2),'crashes per M mi (cumulative)','derived','derived [E]','NHTSA SGO Tesla ADS reports Feb-Sep 2026 / Tesla 3.1M unsupervised miles (22 Jan-18 Oct 2026)',SGO,f'{len(t)} SGO reports. Rough: Jan 2026 excluded (mix of monitored and unsupervised); SGO reports may include remaining monitored/Bay Area-excluded ops; miles window extends to 18 Oct so rate is likely understated slightly. Any severity, any fault - comparable in definition to Waymo cumulative series but not in mix.')
add('2026-10-18','Tesla','all','injury_crashes_count',0,'people injured','company','company-stated',TS,RTT,'Tesla report: 0 people injured in SGO-reported driverless collisions through 18 Oct 2026.')
# ---- 4. markets
mk=[('Waymo','Phoenix','US','2020-10-08','2020-10-08','live',355,'https://waymo.com/blog/2020/10/waymo-is-opening-its-fully-driverless/'),
('Waymo','San Francisco Bay Area','US','2022-12-01','2023-08-10','live',338,'https://www.cpuc.ca.gov/news-and-updates/all-news/cpuc-approves-permits-for-cruise-and-waymo-to-charge-fares-for-passenger-service-in-sf-2023'),
('Waymo','Los Angeles','US','2024-03-14','2024-11-12','live',122,RTL),
('Waymo','Austin','US','2025-03-04','2025-03-04','live (Uber app)',150,RTL),
('Waymo','Atlanta','US','2025-06-24','2025-06-24','live (Uber app)',112,RTL),
('Waymo','Miami','US','2026-01-22','2026-01-22','live',154,WH),
('Waymo','Dallas','US','2026-02-24','2026-02-24','live',48,WH),('Waymo','Houston','US','2026-02-24','2026-02-24','live',49,WH),
('Waymo','San Antonio','US','2026-02-24','2026-02-24','live',59,WH),('Waymo','Orlando','US','2026-02-24','2026-02-24','live',66,WH),
('Waymo','Nashville','US','2026-04-07','2026-04-07','live',50,WH),('Waymo','Denver','US','2026-09-01','2026-09-01','live',None,WH),
('Waymo','Tampa','US','2026-09-01','2026-09-01','live',44,WH),('Waymo','San Diego','US','2026-09-01','2026-09-01','live',46,WH),
('Waymo','Las Vegas','US','2026-09-14','2026-09-14','rolling out (riders added gradually)',None,'https://www.robotaxistats.com/services/waymo/'),
('Tesla','Austin','US','2026-01-22','2025-06-22','live',272,RTT),('Tesla','Dallas','US','2026-04-18','2026-04-18','live',None,RTT),
('Tesla','Houston','US','2026-04-18','2026-04-18','live',None,RTT),('Tesla','Miami','US','2026-07-03','2026-07-03','live',None,RTT),
('Tesla','Orlando','US','2026-07-21','2026-07-21','live',None,RTT),('Tesla','Tampa','US','2026-07-21','2026-07-21','live',None,RTT),
('Tesla','San Francisco Bay Area','US',None,None,'supervised (safety driver) - not driverless',None,RTT),
('Tesla','Las Vegas','US',None,None,'coming soon',None,RTT),('Tesla','Phoenix','US',None,None,'coming soon',None,RTT),
('Tesla','San Antonio','US',None,None,'coming soon',None,RTT),('Tesla','Jacksonville','US',None,None,'coming soon',None,RTT),
('Zoox','Las Vegas','US',None,'2026-08-10','live (paid)',None,'https://www.reuters.com/business/autos-transportation/amazons-zoox-start-paid-robotaxi-rides-vegas-next-week-2026-08-05/'),
('Zoox','San Francisco Bay Area','US',None,None,'testing / early riders',None,'https://www.robotaxistats.com/services/zoox/'),
('Pony.ai','Guangzhou','CN',None,None,'live',None,'https://ir.pony.ai/news-releases/news-release-details/pony-ai-inc-reports-second-quarter-2026-financial-results-total'),
('Pony.ai','Shenzhen','CN',None,None,'live',None,'https://ir.pony.ai/news-releases/news-release-details/pony-ai-inc-reports-second-quarter-2026-financial-results-total'),
('Pony.ai','Singapore','SG',None,None,'public via ComfortDelGro Zig app',None,'https://ir.pony.ai/news-releases/news-release-details/pony-ai-inc-reports-second-quarter-2026-financial-results-total'),
('Baidu Apollo Go','Wuhan','CN',None,None,'live',None,'https://wh.bendibao.com/news/2024229/176753.shtm'),
('Baidu Apollo Go','Dubai','AE',None,None,'live (fully driverless commercial, Q2 2026)',None,'https://www.sec.gov/Archives/edgar/data/1329099/000119312526355431/d112854dex991.htm'),
]
notes_mk={('Waymo','San Francisco Bay Area'):'Driverless start date = robotracker first SF area point; paid driverless from CPUC approval 10 Aug 2023.',('Tesla','Austin'):'Paid service from 22 Jun 2025 with passenger-seat safety monitor; no monitor from 22 Jan 2026. Area 272 sq mi per robotracker.',('Waymo','Los Angeles'):'Paid rides to waitlist from Mar 2024; open to all 12 Nov 2024.'}
M=[]
for op,c,co,dd,pd_,st,sq,u in mk:
    M.append(dict(operator=op,market=c,city=c,country=co,driverless_launch_date=dd,paid_launch_date=pd_,status=st,geofence_sq_mi=sq,geofence_km2=round(sq*2.589988,1) if sq else None,source_url=u,notes=notes_mk.get((op,c),'')))
    if sq: add('2026-10-27',op,c,'geofence_area_sq_mi',sq,'sq mi','third-party','analyst estimate','robotracker.app (land area, measured from maps)',RTL if op=='Tesla' else 'https://robotracker.app/operators/2','Third-party measurement; companies rarely publish per-city area.')
# markets_count step series (driverless, public, paid)
for op in ['Waymo','Tesla']:
    ds=sorted(x['driverless_launch_date'] for x in M if x['operator']==op and x['driverless_launch_date'] and x['status'].startswith(('live','rolling')))
    for dt in sorted(set(ds)):
        add(dt,op,'all','markets_count',sum(1 for x in ds if x<=dt),'metros','derived','derived [E]','Count of markets.csv driverless launch dates','',  'Metros with public driverless rides (no one in driver seat; for Tesla no in-car monitor). Counts launch events; see markets.csv sources.')
add('2026-08-10','Zoox','all','markets_count',1,'metros','media','reported','Reuters','https://www.reuters.com/business/autos-transportation/amazons-zoox-start-paid-robotaxi-rides-vegas-next-week-2026-08-05/','Paid Las Vegas.')
add('2026-08-18','Baidu Apollo Go','all','markets_count',28,'cities','company','company-stated','Baidu Q2 2026 6-K','https://www.sec.gov/Archives/edgar/data/1329099/000119312526355431/d112854dex991.htm','"Global footprint" incl. testing/pilots - not all public driverless paid. Not comparable with US counts.')
add('2026-10-29','Waymo','all','markets_count',15,'cities','company','company-stated','Alphabet Q3 2026 call (Pichai)','https://www.fool.com/earnings/call-transcripts/2026/10/29/alphabet-googl-q3-2026-earnings-call-transcript/','15 major US cities incl. Las Vegas rolling out.')
# geofence totals history
for line in open(R+'rt_hist.txt'):
    op,_,rest=line.partition(' '); cnt,_,pts=rest.partition(' ')
    seen=None
    for x,y in ast.literal_eval(pts):
        if y==0 or y==seen: continue
        seen=y; add(x,op,'all','geofence_area_sq_mi',y,'sq mi','third-party','analyst estimate','robotracker.app leaderboard history',RTL,'Total fully-public, fully-unsupervised service area (robotracker rules exclude waitlist/rollout cities; Tesla counted Austin only). Land area only.')
add('2026-05-13','Waymo','all','geofence_area_sq_mi_company_stated',1400,'sq mi','company','company-stated','Waymo blog','https://waymo.com/blog/shorts/growing-to-1400-sqm/','"over 1,400 square miles across 11 cities" over following weeks.')
# ---- 5. cost per mile
cpm=[('2026-04-30','Waymo',1.43,'Morgan Stanley (Percoco) - current Jaguar fleet','https://finance.yahoo.com/markets/stocks/articles/tesla-stock-investors-just-got-083200689.html',''),
('2026-04-30','Tesla',0.81,'Morgan Stanley (Percoco) - Model Y robotaxi','https://finance.yahoo.com/markets/stocks/articles/tesla-stock-investors-just-got-083200689.html',''),
('2026-04-30','Human ride-hail',1.71,'Morgan Stanley (Percoco)','https://finance.yahoo.com/markets/stocks/articles/tesla-stock-investors-just-got-083200689.html','Benchmark.'),
('2026-06-30','Tesla',0.60,'ARK (as reported by HEP Fund)','https://www.thehepfund.com/post/robotaxis','Secondary source; date approximate (2026).'),
('2026-10-23','Waymo',1.395,'Deutsche Bank via AIO APEX - 5th gen','https://www.aioapex.com/en/blog/robotaxi-expansion-is-accelerating-in-2026-but-the-per-mile-math-still-does-not--mvkkozbi','Vehicle/operating cost per mile (Deutsche Bank, 5th-gen Jaguar). Midpoint of $1.36-1.43; secondary source.'),
('2026-10-23','Waymo',1.98,'Morgan Stanley all-in 2025 via AIO APEX','https://www.aioapex.com/en/blog/robotaxi-expansion-is-accelerating-in-2026-but-the-per-mile-math-still-does-not--mvkkozbi','All-in incl. overhead; unverified secondary.')]
for dt,op,v,s,u,nt in cpm: add(dt,op,'all','cost_per_mile_allin_usd' if 'all-in' in s else 'cost_per_mile_usd',v,'USD/mi','analyst','analyst estimate',s,u,nt)
add('2026-10-23','Waymo','all','cost_per_mile_next_gen_usd',1.035,'USD/mi','analyst','analyst estimate','Deutsche Bank via AIO APEX - 6th gen Ojai','https://www.aioapex.com/en/blog/robotaxi-expansion-is-accelerating-in-2026-but-the-per-mile-math-still-does-not--mvkkozbi','Midpoint of $0.99-1.08.')
add('2026-10-21','Tesla','all','cost_per_mile_target_usd',0.30,'USD/mi','company','company-stated','Tesla CFO Taneja, Q3 2026 call','https://www.fool.com/earnings/call-transcripts/2026/10/22/tesla-tsla-q3-2026-earnings-call-transcript/','Target, not yet reached.')
add('2024-10-10','Tesla','all','cost_per_mile_target_usd',0.20,'USD/mi','company','company-stated','Musk at Cybercab unveil (Reuters)','https://www.reuters.com/technology/teslas-musk-unveil-robotaxis-amid-fanfare-skepticism-2024-10-10/','Cybercab "over time".')
# ---- 6. fare per mile
REF={'rtpds':'https://robotaxiprice.com/dataset/downloads/observations.csv','basenor':'https://www.basenor.com/blogs/news/tesla-robotaxi-pricing-changes-in-austin-what-youll-pay-now','natapx':'https://www.notateslaapp.com/news/3779/tesla-raises-robotaxi-price-again-with-40-increase','rtp':'https://robotaxiprice.com/tesla-robotaxi-price/','obijan':'https://rideobi.com/tesla/','obiq1':'https://rideobi.com/teslaq1/','rj':'https://www.reviewjournal.com/news/news-columns/road-warrior/zoox-robotaxi-fares-top-lyft-prices-across-las-vegas-routes-3865010/','atlas':'https://www.robotaxiatlas.com/waymo-price/','casinos':'https://www.casinos.com/us/news/zoox-robotaxis-begin-paid-ride-service-across-las-vegas-strip','bdb':'https://wh.bendibao.com/news/2024229/176753.shtm','citic':'https://img2.zhitongcaijing.com/content/detail/1153564.html','ievchina':'https://ievchina.com/ai-mobility/beijing-robotaxi-commercial-2026-baidu-apollo-pony-ai/'}
P=pd.read_csv('/workspace/docx/robotaxi-SzkjWW/pricing_usd_per_mile.csv')
def opmap(s):
    for k,v in [('Tesla','Tesla'),('Waymo','Waymo'),('Zoox','Zoox'),('Baidu','Baidu Apollo Go'),('Lyft','Human ride-hail (Lyft)'),('UberX','Human ride-hail (Uber)'),('Uber','Human ride-hail (Uber)')]:
        if s.startswith(k): return v
for _,r in P.iterrows():
    op=opmap(r.operator)
    if op is None or '/' in r.operator: continue
    dt=str(r.date).split(' to ')[-1]; dt=dt if len(dt)==10 else (dt+'-15' if len(dt)==7 else dt+'-06-30')
    v=str(r.usd_per_mile); 
    if '-' in v: lo,hi=map(float,v.split('-')); v=(lo+hi)/2; extra=f' Midpoint of {r.usd_per_mile}.'
    else: v=float(v); extra=''
    sup=' SUPERVISED service (safety driver).' if 'supervised' in r.operator else ''
    conf='derived [E]' if r.basis=='E' else 'reported'
    city={'SF Bay Area':'San Francisco Bay Area','China':'Wuhan'}.get(r.group,r.group)
    if 'Beijing' in str(r.city): city='Beijing'
    key='fare_per_mile_usd'
    if 'Cybercab' in r.operator: key='fare_per_mile_usd_cybercab'; sup+=' Vehicle: Cybercab.'
    elif op=='Tesla' and 'Model Y' in r.operator: sup+=' Vehicle: Model Y (main fleet).'
    if 'after subsidy' in r.operator: key='fare_per_mile_usd_after_subsidy'; sup+=' CSC ASSUMED post-subsidy paid fare (CNY1.1/km), broker estimate.'
    if 'launch promo' in r.operator: key='fare_per_mile_usd_after_subsidy'; sup+=' Verified 31 Oct 2026 on iEV China: "just over 2 yuan" for 5.9 km (3.66 mi) Beijing Yizhuang launch fare, described as not profitable/familiarity-building, i.e. promotional/subsidised. (Source prints $0.30 for 2 yuan, an FX error; at 6.6616 CNY/US$ it is ~$0.30 per ride = $0.08/mi.)'
    if 'pre-subsidy' in r.operator: sup+=' CSC weighted list fare BEFORE subsidy.'
    add(dt,op,city,key,round(v,2),'USD/mi','media/third-party',conf,r.ref,REF.get(r.ref,''),f'{r.operator}: {r.method}. Original: {r.original_quote}.{extra}{sup} CNY at 6.6616/USD (ECB 29 Oct 2026) where applicable.')
add('2026-10-29','Waymo','all','fare_per_mile_usd',4.75,'USD/mi','derived','derived [E]','Fin Analyst derivation (Other Bets rev, rides/wk, 3.9 mi CPUC trip length)','https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm','Realised revenue per paid mile; midpoint of $4.4-5.1 range from three methods.')
# ---- 7. fleet
fl=[('2025-05-05','Waymo','all',1500,'Waymo blog May 2025 (1,500+)','https://www.robotaxistats.com/services/waymo/','company-stated'),
('2025-12-31','Waymo','all',3067,'TechCrunch','https://techcrunch.com/2026/03/27/waymo-skyrocketing-ridership-in-one-chart/','reported'),
('2026-05-06','Waymo','all',3791,'NHTSA Part 573 recall population','https://static.nhtsa.gov/odi/rcl/2026/RCLRPT-26E026-6527.pdf','reported'),
('2026-06-17','Waymo','all',3871,'NHTSA Part 573 recall population','https://static.nhtsa.gov/odi/rcl/2026/RCLRPT-26E035-7637.pdf','reported'),
('2026-09-01','Waymo','all',4000,'TechCrunch (more than 4,000)','https://techcrunch.com/2026/09/24/waymo-is-scaling-fast-heres-what-the-fleet-data-shows/','reported'),
('2026-01-31','Zoox','all',50,'Motorgrail via research dossier (~50)','https://www.reuters.com/business/autos-transportation/amazons-zoox-start-paid-robotaxi-rides-vegas-next-week-2026-08-05/','reported'),
('2026-09-17','Zoox','all',100,'TechCrunch (~100)','https://techcrunch.com/2026/09/17/','reported'),
('2026-06-30','Pony.ai','all',1975,'Pony.ai Q2 2026 6-K','https://www.sec.gov/Archives/edgar/data/1969302/000110465926098113/tm2623382d1_ex99-1.htm','company-stated'),
('2026-04-30','WeRide','all',1300,'WeRide SEC filing (~1,300 robotaxis)','https://www.sec.gov/Archives/edgar/data/0001867729/','company-stated'),
('2026-07-31','WeRide','all',1800,'WeRide IR (>1,800 robotaxis)','https://ir.weride.ai/node/9321/html','company-stated'),
('2026-10-15','Tesla','Austin',300,'Teslarati (300+ Cybercabs in Austin service)','https://www.teslarati.com/tesla-cybercab-dallas/','reported')]
for dt,op,m,v,s,u,c in fl: add(dt,op,m,'fleet_size',v,'vehicles','company' if c=='company-stated' else 'media',c,s,u,'Approximate where source says ~ or more than.' + (' Cybercabs only.' if op=='Tesla' else ''))
for dt,v in [('2026-06-09',69),('2026-09-29',546),('2026-10-03',589),('2026-10-10',739),('2026-10-22',858),('2026-10-24',970),('2026-10-27',1080)]:
    add(dt,'Tesla','Texas','fleet_size_registrations',v,'vehicles','regulator','reported','Texas DMV automated motor vehicle registry (via robotaxistats/robotscount)','https://txmccs.txdmv.gov/','Registered, not necessarily in service; statewide Texas (Model Y + Cybercab). Tesla publishes no fleet count.')
# ---- 8. paid rides / week & rides
for dt,v,s,u in [('2024-05-31',50000,'TechCrunch','https://techcrunch.com/2026/03/27/waymo-skyrocketing-ridership-in-one-chart/'),('2025-05-05',250000,'Waymo blog','https://www.robotaxistats.com/services/waymo/'),('2026-02-02',400000,'Waymo blog','https://www.robotaxistats.com/services/waymo/'),('2026-03-26',500000,'Waymo','https://www.robotaxistats.com/services/waymo/')]:
    add(dt,'Waymo','all','paid_rides_per_week',v,'rides/week','company','company-stated',s,u,'Lower bound ("+"). Not updated on Q3 2026 call.')
add('2026-03-31','Baidu Apollo Go','all','paid_rides_per_week_peak',350000,'rides/week','company','company-stated','Baidu Q1 2026 release (peak week)','https://www.prnewswire.com/news-releases/baidu-announces-first-quarter-2026-results-302774476.html','Peak week; fully driverless operational rides (may include discounted).')
bq=pd.read_csv(R+'rc_av_rides_quarter.csv')
for _,r in bq.iterrows():
    add(r.period,'Baidu Apollo Go','all','rides_per_quarter',r.value,'rides','company','company-stated',r.publisher,r.source_url,'Fully driverless operational rides in quarter.')
    add(r.period,'Baidu Apollo Go','all','paid_rides_per_week_avg_derived',round(r.value/13),'rides/week','derived','derived [E]',r.publisher,r.source_url,('GENUINE DROP: Baidu Q2 2026 call/6-K - ~1M rides (vs 3.2M Q1) due to "operational adjustments in certain domestic cities due to regulatory considerations" (after April Wuhan fleet incident/permit pause); resumed Aug 2026. ' if r.period=='2026-06-30' else '')+'Quarterly fully driverless rides / 13 = average week [E]. Not comparable with the 350k company-stated PEAK week (Mar 2026, key paid_rides_per_week_peak); Q2 2026 also hit by regulatory pauses. Baidu does not say rides are all paid.')
for dt,op,v,u in [('2026-09-17','Waymo',20e6,'https://waymo.com/blog/2026/09/waymo-in-singapore'),('2026-06-30','Baidu Apollo Go',23e6,'https://www.fool.com/earnings/call-transcripts/2026/08/18/')]:
    add(dt,op,'all','cumulative_rides',v,'rides','company','company-stated','company',u,'Lower bound.')
# ---- extras: Waymo financials
for dt,rev,loss in [('2026-03-31',411e6,-2.1e9),('2026-06-30',382e6,-1.8e9),('2026-09-30',372e6,-2.047e9)]:
    add(dt,'Waymo','all','other_bets_operating_income_usd',loss,'USD/quarter','company','company-stated','Alphabet results (Other Bets segment, mostly Waymo)','https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm','Includes non-Waymo bets.')
    add(dt,'Waymo','all','other_bets_revenue_usd',rev,'USD/quarter','company','company-stated','Alphabet results (Other Bets segment)','https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm','')
add('2026-06-30','Pony.ai','all','robotaxi_revenue_usd',12.1e6,'USD/quarter','company','company-stated','Pony.ai Q2 2026 6-K','https://www.sec.gov/Archives/edgar/data/1969302/000110465926098113/tm2623382d1_ex99-1.htm','')

# ---- follow-ups 31 Oct
add('2026-10-21','Tesla','all','markets_count',6,'metros','company','company-stated','Tesla Robotaxi site (via robotaxistats), Q3 2026','https://www.robotaxistats.com/services/tesla/','Unchanged since 21 Jul: Austin, Dallas, Houston, Miami, Orlando, Tampa driverless. Bay Area supervised excluded; Las Vegas, Phoenix, San Antonio, Jacksonville "coming soon". Q3 call added no new market.')
add('2026-09-30','Tesla','all','cumulative_driverless_miles',2.0e6,'miles','company','company-stated','Tesla Q3 2026 Update','https://www.sec.gov/Archives/edgar/data/1318605/000162828026066738/exhibit9914.htm','"nearly two million cumulative unsupervised miles" at quarter end.')
RB='https://robonomics.substack.com/p/fact-check-on-self-driving-3q26'
for m,v in [('Austin',460),('Dallas',77),('Houston',39)]:
    add('2026-10-27','Tesla',m,'fleet_size_third_party_count',v,'vehicles','third-party','analyst estimate','Robonomics citing third-party trackers (sightings)',RB,'Approximate vehicles identified in unsupervised service; not Tesla-reported. Austin incl. ~230 Cybercabs.')
add('2026-10-27','Tesla','Florida','fleet_size_third_party_count',40,'vehicles','third-party','analyst estimate','Robonomics citing third-party trackers',RB,'Miami+Orlando+Tampa combined, approx.')
FX=1.609344/6.6616
OF='https://www.ofweek.com/ai/2026-05/ART-201712-8110-30688184.html'
add('2026-05-15','Baidu Apollo Go','Wuhan','fare_per_mile_usd',round(5.65*FX,2),'USD/mi','media','reported','OFweek (measured fares)',OF,'Before subsidy: CNY4.6-6.7/km original price (midpoint 5.65) x1.609344 / 6.6616 CNY/US$ (ECB 29 Oct 2026). Range $1.11-1.62/mi.')
add('2026-05-15','Baidu Apollo Go','Wuhan','fare_per_mile_usd_after_subsidy',round(1.8*FX,2),'USD/mi','media','reported','OFweek (measured fares)',OF,'Actual paid CNY1.6-2.0/km after subsidy (midpoint 1.8), after a Wuhan price rise. Range $0.39-0.48/mi.')
KT='https://www.koreatimes.co.kr/business/companies/20250521/trying-chinas-robotaxi-in-wuhan'
add('2025-05-21','Baidu Apollo Go','Wuhan','fare_per_mile_usd',round(92/19*FX,2),'USD/mi','media','derived [E]','Korea Times test ride',KT,'Single 19 km ride; usual fare CNY92 (before promo) / 19 km, converted.')
add('2025-05-21','Baidu Apollo Go','Wuhan','fare_per_mile_usd_after_subsidy',round(33/19*FX,2),'USD/mi','media','derived [E]','Korea Times test ride',KT,'Same ride, CNY33 paid after promotional discount.')

# miles per vehicle per day (Tesla Austin derived)
df=pd.DataFrame(rows).sort_values(['metric','operator','market','date'])
dup=df[df.duplicated(['operator','market','metric','date'],keep=False)]
assert dup.empty, dup.to_string()
df.to_csv(O+'metrics.csv',index=False)
mdf=pd.DataFrame(M); mdf.to_csv(O+'markets.csv',index=False)
clean=lambda recs:[{k:v for k,v in r.items() if v is not None and v==v and v!=''} for r in recs]
json.dump({'generated_at':'2026-10-31','metrics':clean(df.to_dict('records')),'markets':clean(mdf.to_dict('records'))},open(O+'data.json','w'),indent=1)
print(df.groupby(['metric','operator']).agg(n=('value','size'),start=('date','min'),end=('date','max')).to_string())
