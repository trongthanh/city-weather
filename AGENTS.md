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

The working development URL has been `http://localhost:5199/`. Confirm the current server/port; reuse a working server rather than starting duplicates. Vite otherwise defaults to port 5173. Use the background shell tool for dev servers, builds/test batches and agent CLI runs. Don't edit generated `dist/` files.

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
| `src/world/materials.js` | Shared material groups, emissives, light pools, per-tree wind/shadow shaders |
| `src/world/landmarkLighting.js` | Local-space fixtures/glowing details, transformed architectural spotlight records, dusk/night intensity updates |
| `src/core/MeshBuilder.js` | Primitive cache, transform stacks, geometry normalization/merging |
| `src/core/Path.js`, `rng.js` | Arc-length polyline paths, seeded RNG/noise |
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
- Mobile intentionally uses closer framing: `layout()` multiplies the fitting distance by **0.82**, allowing edge cropping. Preserve pinch zoom and desktop framing. Cropping varies with orbit angle; don't require the entire tile to fit.
- The critical styled splash prevents unstyled first paint; preserve it when changing loading/UI.

### Hà Nội

- Map-traced Hoàn Kiếm lake with shoreline-following routes, Tháp Rùa, Ngọc Sơn, Thê Húc and Tháp Bút.
- Lăng Bác + Chùa Một Cột northwest, Văn Miếu southwest, Nhà Thờ Lớn between them; Opera House southeast.
- Red River is on the **east** edge and reddish-brown; the lake is jade-green. Water-bed and skirt colours must follow the nearest water body, not a single global water colour.
- Old Quarter uses ochre French-colonial shophouses, villas and tiled tube houses, with white trim, shutters, balconies and abundant trees. Avoid reverting to generic midrise blocks.
- Opera House (`operaHouse`) is at approximately `(11.1, 16.2)`, rotated by π and scaled 1.2. The default camera sees its **rear**. Preserve framed arched windows on all four façades, glazed entrance doors, porch lamps and nighttime glazing/uplights; front-only windows are insufficient.

### TP. Hồ Chí Minh

- North-to-south order: **Đức Bà Cathedral → Bến Thành Market → Bitexco**. World north is negative z.
- Cathedral around `(-11, -18.3)` stands in an open Công xã Paris square; keep generic buildings out of its block. Post office faces it across the street.
- Bến Thành around `(-10.25, -6.7)` occupies most, but not all, of its block. Keep a forecourt, red gabled hall roofs, corner pavilions and enlarged clock-tower gate. No random buildings in its plaza.
- Bitexco around `(-10.4, 7.8)` is in the garden block **directly south of the market**, as requested in the user's annotation. Don't move it back to the east-side riverside location without approval. Preserve the helipad and keep other buildings out of its block.
- Fewer generic skyscrapers, more parks/trees. Southwest corner and canal frontage should also contain shophouses, not only parkland.
- Preserve Khánh Hội Bridge and Nhà Rồng at the canal/river junction. `canalRow` is a procedural row of canal-front shophouses.

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
node scripts/operacheck.mjs
```

| Check | What it verifies / limitations |
| --- | --- |
| `npm run build` | Vite compilation. The existing >500 kB chunk-size warning is not a build failure. |
| `npm run smoke` | All cities generate; agents run at overnight/rush/off-peak times; cyclone roofs/debris recover in calm. Inspect output for errors and **`NaN matrices`**, which is logged rather than asserted. Counts vary because moving agents use `Math.random`. |
| `node scripts/turncheck.mjs` | 48 vehicle/direction/frame-rate combinations (30/60/120 FPS), entry/exit position and heading continuity, asphalt bounds, closed-road distance seams, forced endpoint planning and bus road-width restrictions. |
| `node scripts/beachcheck.mjs` | Fair-weather beach activity, finite transforms/strings, water/tile bounds, river-only boats, two-sided kite normals, night/storm retirement and city switching. |
| `node scripts/lightcheck.mjs` | Monument/statue/cathedral/Opera House spotlights; bounded counts, rotated/scaled coordinates, no additional shadows, noon-off/night-on/dusk transitions. |
| `node scripts/operacheck.mjs` | Opera House glowing glazing on four façades, porch lamps, rotated/scaled bounds and balanced material transform stacks. |

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

**User requirement: the coordinating agent must not run Chrome DevTools verification directly. Delegate it to a verifier, and run every verifier as a background task.**

- The user-selected verifier route is **OpenAI Luna 6**, CLI selector `--model openai/gpt-6-luna`. Do not silently substitute models; report route failures.
- If you are already the assigned browser verifier, perform the assigned Chrome checks yourself; do **not** recursively launch another verifier.
- The inspect-only `bg_delegate` worker cannot run CLI tests or browser/network work. Use a background Pi CLI task for browser QA; ordinary shell test batches use `isAgent:false`, Pi child runs use `isAgent:true`.
- Write the complete verifier prompt **before** launching the process. A parallel prompt-write/process-start race previously produced a meaningless completed task.
- Example CLI command for a background Pi task (provide a unique, absolute prompt path):

```sh
pi -p --no-session --model openai/gpt-6-luna --thinking low "$(cat /tmp/city-weather-qa-TASK.txt)"
```

- Include URL/port, exact scope, expected features, viewport, focus calls, unique screenshot directory, console/network checks, and required report format in the prompt. Don't rely on omitted conversation/tool output.
- Wait for the terminal notification; don't poll status/logs or sleep just to wait. Retrieve output after notification. A process exit code of 0 is not itself a visual PASS.
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
window.__cw.focus(-11, -18.3, 11, 2, 65, 40);   // Đức Bà
window.__cw.focus(-10.25, -6.7, 16, 1.5);      // Bến Thành
window.__cw.focus(-10.4, 7.8, 32, 8);          // tall Bitexco + helipad
window.__cw.focus(3, -7.4, 7, 0.6);           // HCMC statue
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
