# City activity: time and weather implementation plan

Status: planned by coordinator; implementation delegated to `openai/gpt-6-luna`.

## Goal

Review and tune every existing activity across Hà Nội, Đà Nẵng and HCMC so each responds plausibly to local time, place and weather. No new activity models, downloaded assets, landmark redesigns, all-city weather fetches or expanded instance budgets.

## Audit of current behavior

- `src/agents/AgentSystem.js` owns motorbikes, cars, buses, cyclos, pedestrians with rain umbrellas/nón lá, dogs, cats, river boats, dormant basket boats, jet skis, surfers, kites and birds.
- `trafficLevel()` already has school/work peaks and an overnight floor; preserve it. `streetLife()` has an evening peak, but all walkers use uniformly selected paths.
- `CityGenerator.js` loses extra walkway metadata (`{ path, walkway: true }` only). Sidewalks retain their road. Squares reserve occupancy but do not automatically provide walking routes.
- Beach umbrellas and occasional loungers are permanently merged into `B.main`, using `beachUmbrella()` in `landmarks.js`; they never close at night/in storms.
- Cats use `Math.max(0.3, life)` and have no time dependence. River boats have no time dependence. Kites omit `life`. Birds stop spawning in unsafe weather but active birds continue until their lifetime expires.
- Main only supplies night/life/rain/wind/waves/minutes to agents; lightning, flood, snow and fog are not considered.
- Dog spawns create a pedestrian independently of the pedestrian target, and owner disappearance does not reliably retire a dog.
- Three cities only have river motorboats. Đà Nẵng sea agents are jet skis/surfers, NOT boats or basket boats. Keep this invariant.

## Desired policy

Implement a small pure shared activity-policy module consumed by agents and beach furniture. Inputs are normalized/smoothed visual weather parameters plus local minutes and daylight/night. Defaults must preserve compatibility with existing headless scripts that omit new fields.

- Time curves wrap at midnight, remain finite and continuous, and distinguish early evening from deep night. Keep `trafficLevel()` and `streetLife()` public exports compatible with existing imports.
- Morning recreation around 06:00–09:00 and stronger early-evening square/promenade recreation around 18:00–22:00; taper after 22:00, very quiet around 02:00. Daytime stays visibly alive; do not make every noon scene empty.
- Beach service/recreation daytime roughly 06:00–18:30, further limited by actual daylight (`night`, optionally sunrise/sunset). Beach service furniture absent at night or in rain/unsafe weather. Beachgoers on sand share these restrictions. Urban/coastal promenades may remain active in a pleasant evening without reopening beach service or sea sports.
- Drizzle permits reduced sidewalk activity with rain umbrellas and bike ponchos. Moderate rain suppresses leisure/animals/cyclos much more than ordinary road travel. Heavy rain gives very little exposed leisure. Dangerous lightning, wind, flooding or cyclone conditions shut down exposed outdoor leisure and water sports; strong storms leave only sparse road travel, cyclone extreme all but empty.
- Snow/fog suppress beach/water recreation appropriately; fog also reduces travel/recreation. Do not use darkness as a proxy for unsafe weather or treat all overcast weather as a closure.
- Keep traffic commute rhythm and smooth turning, allowlists, speed limits, connectors, road heights and vehicle geometry unchanged. Bikes more suppressed than cars in poor weather; buses daytime/early evening and fewer overnight.
- Cyclos mostly daylight sightseeing, some calm early evening, none hazardous weather.
- Dogs morning/evening, shelter in rain/storm, always retire with their owner. Owner creation must not exceed the total pedestrian budget/target or route-zone quotas.
- Cats modest day/evening/night activity, no fixed population floor that defeats weather safety.
- River boats mainly daytime, modest calm early evening (not a new invented commercial/tour role), sparse deep night, zero hazardous lightning/wind/waves/flood. Basket support must also be safe but do not introduce basket routes.
- Birds daylight only, and active flocks retire promptly on unsafe weather/night, using existing fade mechanism rather than merely stopping spawns.
- Pedestrian rain umbrellas separate from beach parasols. Keep rain protection in drizzle/rain; suppress sun hats at night if appropriate, avoid broad model redesign.

## Implementation steps

1. Add pure policy/time/weather helpers with no THREE dependency and no per-frame heavyweight allocation. Tune relative targets within existing max instance counts. Expose enough debug information for headless verification if useful.
2. Add explicit route activity metadata (`street`, `square`, `promenade`, `beach`, or similarly documented categories); preserve it through clipping. Use per-zone pedestrian quotas or equivalent rebalance so existing walkers actually shift distribution on time/weather changes, rather than just weighted future spawns. Normalize allocation under the global pedestrian budget; keep essential sidewalk travel represented.
3. Tag current safe paths: Hanoi lake promenade, HCMC Nguyen Hue walks and Bach Dang promenade, Da Nang Han River promenades and sand beach path. Add only small necessary non-paved civic-square walking routes if needed for visible evening use, clearing City Hall steps/statue/fountain/trees/roads/water. Do not auto-route through all landmark occupancy rectangles or add temple-interior access. Keep layout RNG draws unchanged.
4. Move beach umbrella+lounger geometry into its own small merged group/mesh, preserving deterministic original placements/colors and existing RNG draw sequence. Control visibility with the shared safe daytime service policy; smooth transition where feasible without flicker or reconstructing cities every frame. Hide the full service set, including poles and loungers, not just the canopy. Respect shared material ownership and disposal.
5. Pass full relevant weather inputs from main to policy/agents/furniture. Initialize/reset city furniture correctly at loading and switching; no stale night/day state. Retire existing affected agents promptly and recover calmly without duplicate instances/strings, orphaned dogs or sudden mass spawning every frame.
6. Add `scripts/activitycheck.mjs` covering all cities, time and weather matrix, route-zone allocations, furniture state/geometry separation, limits, deterministic time curves, finite matrices, retirement and calm recovery; enhance existing beach regression where appropriate.
7. Update AGENTS.md with durable policy/source map/testing requirements. Keep changes scoped and preserve all existing user/untracked QA files. Do not commit.

## Acceptance and automated verification

- Beach furniture present in fair daytime, absent after settling at night/thunderstorm/storm/cyclone/snow; reappears on calm daylight return. Sea sports and beach-sand walkers use compatible restrictions.
- Hanoi lake/HCMC civic promenade/Da Nang river promenade have greater early-evening leisure allocation than deep night and a meaningful concentration versus ordinary streets. Never increase the global ped maximum or require 02:00 crowds. Directly assert route-zone counts, not only total pedestrian count.
- Leisure suppressed appropriately in drizzle/rain/heavy rain and zero unsafe weather; no active cats/birds/kites/water leisure surviving settled cyclone because of target floors or missing inputs.
- Dogs have active owners and do not inflate pedestrian targets. Both existing agents and new spawns obey policy.
- All existing agent matrices finite, paths bounded, boats remain river-only, city switching and calm recovery work, max budgets unchanged.
- Run full shared-agent batch: `npm run build && npm run smoke && node scripts/turncheck.mjs && node scripts/beachcheck.mjs && node scripts/lightcheck.mjs && node scripts/operacheck.mjs && node scripts/officecheck.mjs`, plus activitycheck, boundscheck, hcmccheck, alleycheck, cathedralcheck, bridgecheck, ringcheck and fpcheck for all three cities if modifying route/layout generation. Inspect NaN smoke output and every informational OVERLAP/EDGE; known Da Nang cathedral overlap is pre-existing.
- Headless tests are not rendered visibility or real-network proof.

## Browser QA plan / current blocker

Coordinator must NOT run browser verification. A browser-capable verifier must be delegated through an available subagent tool, pinned to `openai/gpt-6-luna`; inspect-only bg_delegate and agent CLI commands are not allowed replacements for browser QA. Current coordinating toolset exposes no such write/browser-capable subagent tool, so mark browser QA NOT VERIFIED unless the required tool becomes available. Implementation may use an ordinary background Luna CLI agent; that is not authorization to bypass the browser QA rule.

When a proper verifier tool is available, prepare a self-contained prompt before launch:
- Confirm/reuse working server, intended URL `http://localhost:5199/` (not running at coordinator audit).
- Separate verifier-owned page with explicit pageId on every Chrome MCP call; discover schemas via codemode.
- Evidence directory unique to this task, e.g. `ref/qa-city-activity-<timestamp>-luna-01/`; do not delete or overwrite other runs.
- Desktop 1280x900, mobile 390x844 DPR2 touch/mobile, reload after mobile emulation changes. Wait for __cw/state.city then 8–12s settling; use bounded evaluation waits, not background polling.
- Focused checks: Da Nang day beach `focus(16,4,24,2.3,65,35)`, same view night and thunderstorm/storm, calm recovery; HCMC square `focus(3,-5.7,36,1.5,25,55)` pleasant early evening vs deep night using debug state/test controls (do not equate t=night to exact 20h without checking); Hanoi lake promenade and Da Nang river promenade brief evening/motion checks; one normal mobile UI shot.
- Small evidence set, capture AND read screenshots, observe walkers over time, ensure umbrella+lounger removal/restoration is visible. Do not do a 37-shot whole-site landmark tour.
- Check current-navigation console/network for runtime failures; distinguish weather API warnings. No network-service changes expected.
- Report PASS/PARTIAL/FAIL/NOT VERIFIED, exact observations, screenshot paths, tests/commands, limitations. Completion is not visual PASS.
