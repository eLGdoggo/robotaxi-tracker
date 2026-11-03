# Robotaxi tracker dataset (built 31 Oct 2026, Sydney time, AEDT)

Files: `metrics.csv` (tidy long format), `markets.csv`, `data.json` (`{generated_at, metrics, markets}`, with null or blank fields omitted and values numeric), `raw/` (source downloads). The build script is `../scripts/build_data.py`, and re-running it regenerates all three files.

Operators: Waymo, Tesla, Zoox, Pony.ai, Baidu Apollo Go, WeRide, plus "Human ride-hail" as a benchmark. Market `all` means a company-wide value; any other market value is a city, and Tesla also has a `Texas` row for fleet registrations.

confidence values: `reported` (regulator or media), `company-stated`, `analyst estimate`, `derived [E]`. Nothing is interpolated, so gaps are simply missing rows.

## Chart metrics
| key | definition |
|---|---|
| accidents_per_million_driverless_miles | Waymo: cumulative NHTSA-reportable in-transport crashes with no driver aboard (any severity, any fault, from the Waymo hub CSV2), divided by hub rider-only miles. Tesla: SGO ADS reports Feb–Sep 2026 divided by 3.1M unsupervised miles. Both are derived. |
| crash_reports_count | Raw NHTSA SGO ADS reports per quarter (by incident month, latest report version). Includes testing with safety drivers, and for Tesla includes the period with a safety monitor in the car. Q3 2026 is incomplete. |
| cumulative_driverless_miles | Miles with no human driver. For Tesla, only the unsupervised miles since 22 Jan 2026 (no employee in the car). FSD Supervised, Bay Area safety-driver miles and the period with a passenger-seat monitor are excluded. Baidu is converted from km. |
| markets_count | Metros with public driverless rides. Step series built from the launch dates in markets.csv. Baidu's 28 is a "global footprint" figure that includes testing. |
| geofence_area_sq_mi | robotracker.app land area only (consistent third-party series; excludes waitlist/rollout cities). |
| geofence_area_sq_mi_company_stated | Company statements (Waymo "over 1,400 sq mi across 11 cities", 13 May 2026). |
| cost_per_mile_usd | Analyst vehicle/operating cost per mile (e.g. Deutsche Bank $1.36–1.43 for the 5th-gen car, stored as the midpoint; Morgan Stanley $1.43 Waymo, $0.81 Tesla). |
| cost_per_mile_allin_usd | All-in cost per mile including overhead (Morgan Stanley 2025 Waymo ~$1.98, via AIO APEX, unverified). |
| fare_per_mile_usd | Price per mile charged to riders. [E] rows divide a per-ride fare by an assumed or route distance. CNY is converted at 6.6616 per US$ (ECB, 29 Oct 2026). Ranges are stored as midpoints. Tesla rows are Model Y (main fleet) unless noted; for Apollo Go, this key is the before-subsidy list fare. |
| fare_per_mile_usd_cybercab | Tesla Cybercab fares (Austin, Sep 2026, same route as a Model Y fare). |
| fare_per_mile_usd_after_subsidy | Fare paid after subsidy or promotion: Wuhan $0.27 (CSC's assumed CNY1.1/km, 2024) and Beijing Yizhuang $0.08 (launch fare of ~CNY2 for 5.9 km, verified on iEV China; the source prints $0.30, which is per ride). |
| fleet_size | Vehicles in service or operated, as stated by the company or media (e.g. Tesla Austin 300+ Cybercabs). |
| fleet_size_registrations | Tesla, market `Texas`: Texas DMV automated-vehicle registrations. **Registrations are NOT vehicles in service.** Tesla publishes no fleet count. |
| paid_rides_per_week | Company-stated weekly paid rides (Waymo, lower bounds). |
| paid_rides_per_week_peak | Company-stated PEAK week (Baidu ~350k, Mar 2026). Baidu counts "fully driverless operational rides", not necessarily paid. |
| paid_rides_per_week_avg_derived | [E] quarterly rides ÷ 13 (Baidu). This is an average, not comparable with the peak; Q2 2026 (~77k) reflects regulatory pauses. |

Human ride-hail benchmark operators: `Human ride-hail` (MS cost), `Human ride-hail (Uber)`, `Human ride-hail (Lyft)`.

The build asserts that no two rows share operator+market+metric+date.

Extra keys: fleet_size_third_party_count (sightings-based estimates, not company figures), accidents_per_million_driverless_miles_quarterly, injury_crashes_per_million_miles, injury_crashes_per_million_miles_human_benchmark, injury_crashes_count, cost_per_mile_target_usd, cost_per_mile_next_gen_usd, cumulative_rides, rides_per_quarter, other_bets_revenue_usd, other_bets_operating_income_usd, robotaxi_revenue_usd.

## Caveats
- The Tesla and Waymo crash rates are not like-for-like. Tesla's sample is small (21 reports), and Tesla publishes no per-month miles.
- Waymo's pre-2024 rider-only miles have only one point (7.1M through Oct 2023), so the crash-rate series starts in Jun 2024.
- Waymo hasn't published a fleet count since May 2025; later counts come from media and NHTSA recall populations. Tesla publishes no fleet count or per-city area.
- Only Waymo has a geofence history before 2025. robotracker counts only Austin for Tesla.
- Cost per mile is analyst-only, often from secondary sources (for example Morgan Stanley's $1.98, which couldn't be verified).

## Refresh
1. NHTSA SGO CSVs: static.nhtsa.gov/odi/ffdd/sgo-2021-01/ (current file + Archive-2021-2025/), updated monthly.
2. Waymo hub CSV1/CSV2 (links on waymo.com/safety/impact), updated quarterly. Add the new cumulative miles to `wm` in the script.
3. Tesla Robotaxi Safety Report, via robotaxistats.com/services/tesla.
4. robotracker.app/leaderboard: the embedded chart JSON gives area history (save to raw/rt_leaderboard.html).
5. Company quarterly results (Alphabet, Baidu, Pony, WeRide).
Then run `python3 scripts/build_data.py`.

## Consolidated headline series, margins and chart_config (added 31 Oct 2026)
- `fare_per_mile_usd` at market `all` is one value per operator per quarter, dated at the quarter end (or the build date for the current quarter), marked derived [E]. Tesla uses the Austin Model Y rows, averaged within the quarter. When there is no Austin row it uses the simple average of driverless cities (only Q2 2026, Dallas). The supervised Bay Area service is excluded. Waymo and Zoox use a simple average of their city rows. Baidu uses the Wuhan before-subsidy fare. These are list or quoted fares. City and variant rows stay as they are for the breakdown charts.
- `fare_per_mile_realised_usd` is Waymo's realised revenue per mile ($4.75). It used to be stored at fare_per_mile_usd/all.
- `fleet_size` Tesla/all is the sum of the same-date third-party city counts (27 Oct 2026). It is an estimate.
- `margin_per_mile_usd` is the quarterly fare at `all` minus the latest cost_per_mile_usd estimate on or before the quarter end. A cost estimate is carried forward for no more than 12 months. This is a ROUGH ESTIMATE. `_low_`/`_high_` use the highest and lowest cost estimates from the prior 12 months. For Waymo these include the Deutsche Bank $1.36–1.43 range and the Morgan Stanley all-in $1.98. Baidu is skipped because there is no cost estimate.
- `chart_config` is rebuilt automatically. It has one entry per (metric, group). `group` is `compare` (rows at `all`, across operators) or `breakdown:<operator>` (that operator's markets). `publish` is true only when there are 2 or more series and at least one series has 2 or more points.
- Tesla `fleet_size` at `all` before 2026 is the Austin third-party tracker count of unique vehicles seen (29, 32, 34 in Nov–Dec 2025). It counts as company-wide because Austin was Tesla's only robotaxi city then. These are vehicles seen, not vehicles active at once.
- Rows marked `community [C]` come from X posts that quote the community Robotaxi Tracker (robotaxitracker.com by @ethanmckanna). They fill gaps only and never replace official figures. Tesla `fleet_size_supervised` is the Bay Area fleet that runs with safety drivers.
- **Backfill on 31 Oct 2026 from tracker sources.**
  - Tesla city geofence history comes from X posts (community [C]). These are advertised app polygons, while robotracker.app reports measured land area.
  - Waymo city geofence history uses company-advertised areas from KTAR and TechCrunch. Later points are robotracker.app land area, so part of each step is a change of basis.
  - Tesla `markets_count` starts at 1 on 22 Jun 2025, the Austin launch with a safety monitor in the passenger seat. Later points count fully driverless markets.
  - Tesla has a second accident-rate point (30 Sep: 21 SGO reports over 2.0M miles). The earlier 6.77 point is now dated 18 Oct to match its 3.1M miles. Both points use the same numerator.
  - Tesla `fleet_size_third_party_count` has history for Austin and Houston.
  - Pony.ai fleet adds 961 (Nov 2025) and 1,159 (end of 2025).
  - Tesla cumulative miles adds the live-counter estimate of 4.05M on 30 Oct.
  - robotaxitracker.com's JSON API refuses automated clients, so it was not scraped.

## Weekly refresh 4 Nov 2026
- Tesla Fort Worth: unsupervised launch 2 Nov 2026 (markets_count now 7); launch geofence ~143 sq mi (media estimate from Tesla map; Robotaxi Log ~104).
- Waymo Los Angeles: company-stated 210 sq mi after South Bay expansion (3 Nov 2026).
