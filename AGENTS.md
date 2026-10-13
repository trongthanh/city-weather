# City Weather — agent guide

## Purpose and working rules

A mobile-friendly, Vietnamese/English three.js site showing procedural floating-city dioramas of **Hà Nội, Đà Nẵng and TP. Hồ Chí Minh**, with live weather and animated street life.

- Read the relevant source before editing. Keep changes scoped to the task; preserve existing user changes.
- Prioritize recognizable landmarks, clear sightlines and the miniature/poster art direction. Reference images are in `ref/` (`hanoi.jpg`, `ho-chi-minh.jpg`). Exaggerated landmark scale is intentional.
- Keep cities/landmarks procedural; don't introduce downloaded city models or heavy postprocessing without approval.
- Keep VI/EN strings in `src/ui/i18n.js`, not hard-coded into UI handlers.
- Keep this guide current when architecture, testing or durable user requirements change. Some landmark descriptions in `README.md` are historical; current city modules and this guide describe the newer layout.
- The directory name ends in `.git`, but at the time this guide was written it was **not a Git repository**. Check before assuming `git diff`/`git status` work. Do not initialize Git or commit unless requested.

## Stack and running the site

Plain JavaScript ES modules, three.js (`^0.186.1`) and Vite (`^8.3.4`). No React, TypeScript, test framework or configured lint command. Use a Node version compatible with Vite 8.

```sh
npm install
npm run dev -- --port 5199 --strictPort
npm run build
npm run preview
```

The working development URL has been `http://localhost:5199/`. Confirm the current server/port; reuse a working server rather than starting duplicates. Vite otherwise defaults to port 5173. Use the background shell tool for dev servers and builds/test batches. Don't edit generated `dist/` files.

## Source map

| Path | Responsibility |
| --- | --- |
| `src/main.js` | Renderer, UI/state, selected-city loading/weather refresh, camera fitting, animation loop, debug handle |
| `src/cities/{hanoi,danang,hcmc}.js` | Seeded layout, landmark positions/footprints, parks/plazas, roads, water routes, building-style distribution |
| `src/cities/index.js`, `palettes.js` | City registry and palettes |
| `src/world/CityGenerator.js` | Terrain → occupancy → roads → landmarks → buildings → trees → merged meshes; city disposal |
| `src/world/Field.js` | Terrain/water signed distances, heights, occupancy; tile size 44, bounds ±22 |
| `src/world/terrain.js` | Terrain/skirt/water meshes, water shader and shared wave function/uniforms |
| `src/world/roads.js` | Roads/sidewalks, bridges, crossings, junctions, lamps and avenue trees |
| `src/world/buildings.js`, `landmarks.js`, `trees.js` | Procedural geometry builders |
| `src/world/facades.js` | Shallow framed/arched windows and shutter rows; shared face transforms across main/glass/lit |
| `src/world/officeWindows.js` | Seeded individual office-window panes on flat and curved/faceted tower façades |
| `src/world/materials.js` | Shared material groups, emissives, light pools, per-tree wind/shadow shaders |
| `src/world/landmarkLighting.js` | Local-space fixtures/glowing details, transformed architectural spotlight records, dusk/night intensity updates |
| `src/core/MeshBuilder.js` | Primitive cache, transform stacks, geometry normalization/merging |
| `src/core/Path.js`, `rng.js` | Arc-length polyline paths, exact square-bound clipping with separate runs, seeded RNG/noise |
| `src/agents/AgentSystem.js`, `models.js` | Instanced traffic, people/pets, river boats, beach agents, birds |
| `src/agents/RoadTurn.js` | Smooth lane-to-lane Bézier connectors and distance-ahead helpers |
| `src/weather/service.js`, `conditions.js` | Open-Meteo forecast/AQI, cache, condition presets/classification |
| `src/weather/Atmosphere.js` | Sun/moon, sky/fog, day/night lighting and shared emissives |
| `src/weather/WeatherFX.js`, `GaleFX.js` | Clouds/precipitation/lightning, cyclone, leaves/debris/uprooted trees and detachable roofs |
| `src/ui/`, `src/style.css`, `index.html` | Localization/icons, responsive UI and styled first-paint splash |

## Durable requirements and current layouts

### Shared

- Fetch weather/AQI **only for the selected city**. Never restore other-city prefetching. Forecast and AQI are separate requests, cached for 10 minutes; refresh the selected city on the interval/visibility return. Simulation still uses selected-city data for the HUD.
- Traffic is busiest around school/work start/end, sparse overnight. Preserve `trafficLevel()` and `streetLife()` rather than replacing them with constant counts.
- Vehicles plan turns in advance, slow down, follow arc-length sampled connectors with matching headings and accelerate afterward. Don't restore instantaneous road switching/position-offset decay as the turning mechanism.
- Keep clouds above the city; foreground clouds should remain semitransparent. Weather clouds are not architectural spotlight cones.
- Rain streaks are instanced, camera-facing quads sized in **screen pixels**: clamp with `uMinPixels` (1.15 CSS px on mobile, 0.85 desktop) so light drizzle stays visible at low DPR/close framing, with a soft darker edge for contrast. Drizzle uses a `^0.68` density curve, slower fall (8+) and shorter streaks than heavy rain; fall phases use accumulated `uTravel`, never raw `uTime`, so speed ramps must not re-phase every drop. Very-near-camera drops fade out; splash rings scale with rain amount. Keep the maximum storm instance budget unchanged.
- Mobile intentionally uses closer framing: `layout()` multiplies the fitting distance by **0.82**, allowing edge cropping. Preserve pinch zoom and desktop framing. Cropping varies with orbit angle; don't require the entire tile to fit.
- The critical styled splash prevents unstyled first paint; preserve it when changing loading/UI.
- Buildings must read well when orbited, not only from their road-facing entrance. Keep rear/side glazing, shutters and trim on houses, public-building wings and churches, especially the north-facing buildings whose backs face the default camera. Use shallow merged details rather than duplicated front porticos or new independent meshes. Added random façade decoration uses forked RNGs so it does not change the parent layout/roof/tree sequence.
- Road `def.vehicles` is an optional vehicle-name allowlist, enforced both at spawning and turn planning. `speedLimit` limits road-agent speeds; preserve narrow-lane offsets and continuous connectors when adding motorcycle-only alleys.
- Road/sidewalk ribbons must stop at the tile edges. Clip promenades with clearance for their **entire width**, and pedestrian routes with lateral/body clearance. Water terrain curves may extend past the tile, but visible boat routes stay inset by 1.2 to accommodate the full bow, drift and wave rotations; boats fade in/out inside that boundary. Use `clipPathToBounds()` instead of filtering points or joining disconnected route fragments.

### Hà Nội

- Map-traced Hoàn Kiếm lake with shoreline-following routes, Tháp Rùa, Ngọc Sơn, Thê Húc and Tháp Bút.
- Lăng Bác + Chùa Một Cột northwest, Văn Miếu southwest, Nhà Thờ Lớn between them; Opera House southeast.
- Nhà Thờ Lớn stays at `(-15.4, -1.5)`, facing east, with **scale 1.5**, not the former oversized 2.4. Keep its small churchyard and two flanking east-west alleys at z≈−3.7 and +0.7, connecting the west tile edge to the lake ring. Each lane is 0.68 wide, has no broad sidewalks/frontage/avenue trees, allows **only motorbikes** (not cars, buses or cyclos) and has a 0.9 speed limit. Church geometry/footprint must clear both alleys.
- Stone alley ribbon tops sit 0.015 below main-road asphalt so the lake-ring junctions do not z-fight; agent path heights remain unchanged for smooth turns. Red River boat lanes use offsets −3.0 and −1.8 on the visible western half of the river, not the former +0.6 route outside the eastern tile edge.
- Red River is on the **east** edge and reddish-brown; the lake is jade-green. Water-bed and skirt colours must follow the nearest water body, not a single global water colour.
- Old Quarter uses ochre French-colonial shophouses, villas and tiled tube houses, with white trim, shutters, balconies and abundant trees. Avoid reverting to generic midrise blocks.
- Opera House (`operaHouse`) is at approximately `(11.1, 16.2)`, rotated by π and scaled 1.2. The default camera sees its **rear**. Preserve framed arched windows on all four façades, glazed entrance doors, porch lamps and nighttime glazing/uplights; front-only windows are insufficient.

### TP. Hồ Chí Minh

- North-to-south order: **Đức Bà Cathedral → Bến Thành Market → Bitexco**. World north is negative z.
- Cathedral around `(-11, -18.3)` stands in an open Công xã Paris square; keep generic buildings out of its block. Post office faces it across the street.
- Bến Thành around `(-10.25, -6.7)` occupies most, but not all, of its block. Keep a forecourt, red gabled hall roofs, corner pavilions and enlarged clock-tower gate. No random buildings in its plaza.
- Bitexco around `(-10.4, 7.8)` is in the garden block **directly south of the market**, as requested in the user's annotation. Don't move it back to the east-side riverside location without approval. Preserve its prominent cantilevered helipad (3.4-wide deck with a large H and circular marking), reserve its full extent in the footprint, and keep other buildings out of its block.
- Fewer generic skyscrapers, more parks/trees. Southwest corner and canal frontage should also contain shophouses, not only parkland.
- Landmark 81, Bitexco and generic office towers use randomly occupied **individual window panes**, not entire emissive floors/rings. Architectural trim and crown accents are separate. Window sampling uses forked seeded RNGs; preserve the parent RNG draw sequence so window edits don't rearrange the rest of the city.
- Landmark 81's main tower is a strongly stepped bundle: low outer shafts, intermediate shoulders, exposed slender square core and rectilinear crown/long square mast. Its podium stays unchanged; don't add surrounding apartment towers to this landmark.
- The entire City Hall / Uncle Hồ statue block (between Đồng Khởi, Tôn Đức Thắng, Lê Duẩn and Lê Lợi) stays open public square, with City Hall, statue and promenade preserved. Its former 19-floor generic tower is pinned as `officeTower` in the far northwest lot at `(-19.5, -18.3)`, with original dimensions/seed. Don't restore random buildings in the civic block.
- City Hall at `(3, -9.6)` spans the full civic-square frontage (11.5-wide façade in the 11.8-wide square) but stays long and low, as in the user's wider/fisheye reference. Architectural modules are scaled to 0.68, with **seven bays per outer wing** and a roughly 4.82-high clock-tower/flag, not the previous oversized 7.09-high monument with short wings. Preserve its yellow/cream two-storey arcades, inner twin terracotta-roofed pavilions, square central clock tower/lantern and flag. Its footprint includes roofs/steps but must leave the unscaled statue at `(3, -7.4)` and the promenade clear.
- Preserve Khánh Hội Bridge and Nhà Rồng at the canal/river junction. `canalRow` is a procedural row of canal-front shophouses.
- Bến Nhà Rồng keeps its position/rotation/scale, quay, red hip roof, ridge dragons and moon. Preserve framed arched glazing on all four elevations, including the land-side rear seen from the default camera, plus white pilasters/floor cornices and subtle nighttime panes; front-only window decoration is insufficient.
- `canalRow` must push/pop each house frame on **main, glass and lit** together. Untransformed glazing previously created a floating window panel at `(0, 0.806)` on the south edge of the civic square; keep all panes attached to the north-facing canal-house façades.

### Đà Nẵng

- Keep Sơn Trà/Linh Ứng and the large Lady Buddha, plus Dragon Bridge, Han River Bridge and Trần Thị Lý Bridge.
- **No Bà Nà/Cầu Vàng** in the current city, despite old README descriptions.
- Boats stay on the Hàn River. **No motor boats or basket boats at sea.** Mỹ Khê sea agents are jet skis and surfers; colourful kites fly above the beach with strings to people on the sand.
- Beach agents should remain inside the water/tile, retire at night/in storms and not appear in non-beach cities. Kite sails need front/back faces; surfers remain visible while paddling.

## Procedural geometry and rendering pitfalls

- Coordinates: x/z form the ground plane, y is height; north = −z, east = +x. Most landmark models face local +z; city layouts apply `ry` and sometimes `scale`.
- `MeshBuilder.box()` takes the **bottom** y, not the centre. `quad()` is a vertical plane facing local +z. Primitives passed through `put()` are generally centred.
- Each material builder (`B.main`, `B.glass`, `B.lit`, `B.lamp`, etc.) has its **own transform stack**. Push/pop the same landmark transform on every material you use. Missing glass/lamp pushes previously put details at the tile origin. All stacks must be balanced after a builder returns.
- Normalize custom geometries with `normalizeGeometry()` before merging: compatible indexed position/normal attributes are required. An unnormalized kite triangle once caused `mergeGeometries()` to fail, followed by `Cannot read properties of null (reading 'computeBoundingSphere')` and a broken scene.
- For double-sided custom sails, use separate reversed vertices/faces with correct normals; shared opposite faces can cancel normals. Don't make every scene material double-sided.
- Static geometry is merged by material; moving agents use `InstancedMesh`. Avoid creating many independent meshes/lights or allocating objects every animation frame.
- `M` materials/uniforms are shared across cities. Changes affect all cities; don't dispose shared materials on city switches.
- `B.lit` provides nighttime glazing, `B.lamp` fixture glow. Architectural spots are real, warm, **unshadowed** lights, controlled by `Atmosphere.lit` through `updateLandmarkLights()`. No volumetric cone geometry is necessary. Current spotlight counts are Hà Nội 6, Đà Nẵng 2, HCMC 3.
- Footprints/plazas/parks control occupancy independently of visible geometry. When resizing/moving a landmark, update its footprint, clear nearby procedural building/tree placement as needed, and inspect road/sidewalk clearance. A correct footprint does not prove actual geometry is correct.
- `Path` distances are arc lengths, including wraparound on closed roads. Preserve position/heading continuity and bridge heights through turns. Existing turning tests do not prove full traffic collision avoidance at every intersection.

## Automated verification

Run commands from the project root. For implementation changes, run the build and smoke test plus relevant targeted regressions; run the full batch for shared rendering/agent changes:

```sh
npm run build &&
npm run smoke &&
node scripts/turncheck.mjs &&
node scripts/beachcheck.mjs &&
node scripts/lightcheck.mjs &&
node scripts/operacheck.mjs &&
node scripts/officecheck.mjs
```

For HCMC landmark/layout edits, also run `node scripts/hcmccheck.mjs` (City Hall long/low proportions/seven-bay wings, statue/sidewalk clearance and rotated material frames, attached canal glazing/no floating square panel, Landmark 81 silhouette/mast, preserved podium, exact office-tower relocation and no generated geometry in the civic square).

For façade changes run `node scripts/facadecheck.mjs`; for the Hanoi cathedral/alleys or road-access changes run `node scripts/alleycheck.mjs` as well as the full batch above.
For road/promenade or water-route boundary changes, also run `node scripts/boundscheck.mjs` (exact route clipping, actual ribbon vertices and full transformed boat hulls, not just centres).

| Check | What it verifies / limitations |
| --- | --- |
| `npm run build` | Vite compilation. The existing >500 kB chunk-size warning is not a build failure. |
| `npm run smoke` | All cities generate; agents run at overnight/rush/off-peak times; cyclone roofs/debris recover in calm. Inspect output for errors and **`NaN matrices`**, which is logged rather than asserted. Counts vary because moving agents use `Math.random`. |
| `node scripts/turncheck.mjs` | 48 vehicle/direction/frame-rate combinations (30/60/120 FPS), entry/exit position and heading continuity, asphalt bounds, closed-road distance seams, forced endpoint planning and bus road-width restrictions. |
| `node scripts/beachcheck.mjs` | Fair-weather beach activity, finite transforms/strings, water/tile bounds, river-only boats, two-sided kite normals, night/storm retirement and city switching. |
| `node scripts/lightcheck.mjs` | Monument/statue/cathedral/Opera House spotlights; bounded counts, rotated/scaled coordinates, no additional shadows, noon-off/night-on/dusk transitions. |
| `node scripts/operacheck.mjs` | Opera House glowing glazing on four façades, porch lamps, rotated/scaled bounds and balanced material transform stacks. |
| `node scripts/officecheck.mjs` | Seeded random tower panes, lit/dark mix, no full-floor emissive strips/rings, curved panes split at profile bends, enlarged Bitexco helipad dimensions/attachment, balanced transforms and unchanged landmark parent RNG streams. |
| `node scripts/facadecheck.mjs` | All seven procedural building styles and seven architectural landmarks have four-elevation glazing; normalized finite geometry, rotated material frames, Nhà Rồng wall bounds/roof icons. It does not prove every detail is unobscured in a rendered view. |
| `node scripts/alleycheck.mjs` | Reduced Hanoi cathedral, two narrow lanes/ring junctions, church clearance, motorcycle-only spawning/turn access, finite bike positions and alley speed limit. Existing traffic tests still do not prove collision avoidance. |
| `node scripts/boundscheck.mjs` | Exact edge intersections/interpolated heights, disconnected route fragments, closed inside loops, actual road/sidewalk/promenade geometry and full boat hulls at both route ends/directions/drift/wave levels. |
| `node scripts/raincheck.mjs` | Rain uniform tuning: mobile/desktop drizzle streaks present, screen-pixel width clamp, heavy rain denser/faster/longer/more opaque, monotonic `uTravel`, splash rings. Headless — no rendered pixels. |

For layout/landmark edits also run:

```sh
node scripts/fpcheck.mjs hanoi
node scripts/fpcheck.mjs danang
node scripts/fpcheck.mjs hcmc
```

`fpcheck` is **informational**: exit code 0 does not mean no overlaps. Inspect every `OVERLAP`/`EDGE` line. Baseline when this guide was written:

- Hà Nội: `hucBridge OVERLAP 0.34` at the intentional bridge landing; other checked footprints `ok`.
- Đà Nẵng: `linhUng ok EDGE` at the intentional peninsula-edge complex; `danangCathedral OVERLAP 0.64` is an existing overlap to investigate if touching that layout, not a blanket exemption.
- HCMC: all checked footprints `ok`.

Headless scripts mock canvas/document for texture construction. They **do not render WebGL**, prove landmark visibility, measure mobile performance or verify live network fetching. There is no `npm test` or `npm run lint` script currently.

## Browser verification — coordinator/subagent contract

**User requirement: delegate browser verification to a background verifier subagent. The coordinating agent must not run Chrome DevTools verification directly.**

- Use the available subagent tool for verification, not an agent CLI command. The user-selected verifier model is **OpenAI GPT-6 Luna** (`openai/gpt-6-luna`); discover its exact available model/variant before use, and report unavailability rather than silently substituting models. Do not inherit the coordinator's Sol model for QA.
- Keep verification scoped to the changed features. A previous overbroad 37-screenshot Sol/high review took about 55 minutes; do not repeat a whole-site tour for a localized follow-up. Use bounded observation and a small evidence set, and report progress/blockers rather than repeatedly saying the verifier is still running.
- If you are already the assigned browser verifier, perform the assigned Chrome checks yourself; do **not** recursively launch another verifier.
- Choose a verifier subagent with browser/network access; an inspect-only worker is not sufficient for browser QA.
- Prepare the complete verifier prompt **before** starting the background subagent.
- Include URL/port, exact scope, expected features, viewport, focus calls, unique screenshot directory, console/network checks, and required report format in the prompt. Don't rely on omitted conversation/tool output.
- Wait for the subagent completion notification; don't poll status/logs or sleep just to wait. Review its report after notification. Task completion alone is not a visual PASS.
- Verifiers discover Chrome MCP schemas through `codemode`, and pass **`pageId` explicitly**. Each task creates its own page, does not close/navigate another task's page, and uses its own screenshot directory. Never delete/overwrite screenshots from another QA run.
- If implementation changes while a review is running, treat pre-reload screenshots as potentially stale; get a fresh check when necessary.

### Browser checks and reproducible screenshots

Use normal UI views at desktop **1280×900** and mobile **390×844**, DPR 2 with touch/mobile emulation. Also check a narrow/landscape viewport for layout changes. Reload after changing mobile emulation: mobile quality/framing selection is determined at startup.

Demo controls:

- `city=hanoi|danang|hcmc` and optional matching `#hash`.
- `w=clear|partly|overcast|fog|drizzle|rain|heavyRain|thunderstorm|storm|cyclone|snow`.
- `t=live|morning|noon|sunset|night`.
- Example: `http://localhost:5199/?city=hanoi&w=clear&t=night#hanoi`.

Wait for `window.__cw` and a loaded `window.__cw.state.city`, then let weather/time transitions settle (typically 8–12 seconds). A bounded readiness/settling wait inside browser evaluation is fine; this is not background-task polling.

The debug handle exposes `state`, `scene`, `camera`, `renderer`, `agents`, `fx`, `gale`, `loadCity`, `cityById` and:

```js
window.__cw.focus(x, z, distance = 14, targetY = 0.5, azimuth = 25, elevation = 40);
```

`focus()` disables auto-rotation, clears the HUD camera offset, permits close distances and sets `state.qaFocus`, so adaptive-resolution layout doesn't undo the shot. **Use it instead of moving the camera position alone.** Navigation/city reset clears QA focus. Do not use it to judge normal mobile/default framing.

Useful close-ups (check current layout if positions change):

```js
// Hà Nội Opera House: rear/default-facing side, then front
window.__cw.focus(11.1, 16.2, 10, 1.3, 25, 35);
window.__cw.focus(11.1, 16.2, 10, 1.3, 200, 35);
// Other Hanoi and HCMC landmarks
window.__cw.focus(-16.5, -11.6, 18, 2, 65, 40); // mausoleum
window.__cw.focus(-15.4, -1.5, 14, 3, 65, 40);  // Hanoi cathedral
window.__cw.focus(-15.4, -1.5, 24, 2, 65, 40); // smaller cathedral + both motorcycle-only alleys
window.__cw.focus(-11, -18.3, 11, 2, 65, 40);   // Đức Bà
window.__cw.focus(-10.25, -6.7, 16, 1.5);      // Bến Thành
window.__cw.focus(-10.4, 7.8, 32, 8);          // tall Bitexco + helipad
window.__cw.focus(3.2, -18.2, 70, 14, 25, 25); // entire Landmark 81 + mast (30-degree FOV)
window.__cw.focus(3, -5.7, 36, 1.5, 25, 55);  // full City Hall / statue square
window.__cw.focus(3, -9.6, 23, 1.6, 0, 25); // long/low City Hall front façade / clock tower
window.__cw.focus(-15, -18.3, 45, 5, 25, 45); // northwest office tower + cathedral/road context
window.__cw.focus(3, -7.4, 7, 0.6);           // HCMC statue
window.__cw.focus(15.1, 20, 14, 1.2, 25, 30); // Nhà Rồng rear/default-facing glazing + dragons
window.__cw.focus(15.1, 20, 14, 1.2, 200, 30); // Nhà Rồng waterfront/front
window.__cw.focus(16, 4, 24, 2.3, 65, 35);     // Đà Nẵng beach
```

For geometry close-ups only, a verifier may temporarily hide overlays with `visibility:hidden` on `header`, `nav`, `#hint`, `#sim-panel`, `#toast`. Keep the canvas visible. Take separate normal-UI screenshots for mobile/UI acceptance.

- Capture and **read the screenshots**. Active agent counts/light intensities alone do not establish visible models or good framing.
- Confirm no current-navigation console errors. Separate API/offline warnings from geometry/runtime failures.
- For weather-service edits, inspect network requests: initial load only queries the selected city's coordinates; switching cities queries that city, with no all-city prefetch. Forecast/AQI request counts aren't city counts.
- For traffic edits, observe motion over time at rush hour vs overnight; a still image doesn't verify smooth turns. Check both directions, buses and bikes, entry/exit continuity and bridge junctions.
- For lighting/landmark edits, inspect day and night from the default angle and a useful close-up. Nearby roofs, weather clouds and cropped tall landmarks can obscure things without proving the model is absent. Architectural wash is deliberately modest; classify brightness/readability separately from missing lights.
- For storm changes, include `w=cyclone`, then calm restoration; verify clouds above ground, transparent foreground, per-tree bending/shadows and roof/debris recovery.
- Reports must distinguish **PASS / PARTIAL / FAIL / NOT VERIFIED**, give concrete reasons, screenshot paths, commands/results and remaining limitations. Don't blindly accept landmark misidentifications; review source coordinates and evidence before changing layout.
