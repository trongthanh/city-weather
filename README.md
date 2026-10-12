# Thời tiết 3D · City Weather

Procedural three.js dioramas of Vietnamese cities showing **realtime weather**, styled after the floating-tile posters in `ref/`.

- **Cities:** Hà Nội, Đà Nẵng, TP. Hồ Chí Minh. Each one is generated procedurally from a seed: terrain, water, roads, buildings, trees and landmarks.
- **Landmarks:**
  - Hà Nội: Tháp Rùa, Cầu Thê Húc, Đền Ngọc Sơn, Tháp Bút and a lakeside pavilion.
  - Đà Nẵng: Cầu Rồng, Cầu sông Hàn, Cầu Vàng with its giant hands, the Sơn Trà Lady Buddha, Nhà thờ Con Gà, a beach with umbrellas, and *thúng chai* basket boats.
  - TP. HCM: Landmark 81, Bitexco (with its helipad), Nhà thờ Đức Bà, Bưu điện, UBND with the Nguyễn Huệ walking street and fountain, chợ Bến Thành, and Cầu Thủ Thiêm 2.
- **Weather:** live data comes from [Open-Meteo](https://open-meteo.com) (forecast plus air quality, no API key needed) and refreshes every 10 minutes. There are 11 visual conditions, from sunny through rain and thunderstorms up to a **super typhoon**. The typhoon has a spiral cloud vortex, horizontal rain, lightning, flying debris, flooding with muddy water, big waves and bending trees. Snow and fog are also included.
- **Life:** motorbikes (riders wear ponchos when it rains), cars and taxis, buses, cyclos, pedestrians (some wear a *nón lá*; they open umbrellas in rain), dogs walking with their owners, cats, boats and birds. Traffic enters and leaves the tile, slows for junctions, follows curved lane-to-lane turns with matching headings, and follows the vehicle ahead. Fewer people are out at night and in storms.
- **Time of day:** the sun position comes from the city's real sunrise and sunset. At night, windows and street lamps light up and vehicles have headlight beams. The Hồ Chí Minh monument/statue, cathedrals and Hà Nội Opera House have warm architectural uplighting; the Opera House has glowing framed windows on every façade.
- **Languages:** Vietnamese and English (VI/EN toggle).
- **Mobile:** layout adapts to portrait and landscape, with touch orbit and pinch zoom. Mobile uses lower detail, and resolution drops automatically if the frame rate falls.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run smoke    # headless generation + agent simulation test
node scripts/turncheck.mjs   # turning continuity, lane bounds and frame-rate checks
node scripts/beachcheck.mjs  # beach activity and weather/city switching checks
```

### URL parameters (handy for demos)

| Param | Values |
| --- | --- |
| `city` or `#hash` | `hanoi`, `danang`, `hcmc` |
| `w` (simulate weather) | `clear`, `partly`, `overcast`, `fog`, `drizzle`, `rain`, `heavyRain`, `thunderstorm`, `storm`, `cyclone`, `snow` |
| `t` (time of day) | `live`, `morning`, `noon`, `sunset`, `night` |

Example: `/?city=danang&w=cyclone&t=night`

## Architecture

```
src/
  main.js                 renderer, camera framing, UI wiring, main loop
  cities/                 one module per city (layout + building style) — add new cities here
  world/
    CityGenerator.js      pipeline: terrain → roads → landmarks → buildings → trees → merged meshes
    Field.js              signed-distance terrain (lakes, rivers, sea, islands, hills, parks) + occupancy grid
    terrain.js            ground mesh, layered slab sides, animated water (shared wave fn for boats)
    roads.js              road/sidewalk ribbons, auto bridges over water, markings, zebra crossings, lamps, junctions
    buildings.js          tube houses, colonial villas, mid-rise, glass towers, beach hotels
    landmarks.js          hand-modelled procedural icons
    trees.js, materials.js
  agents/                 instanced traffic, pedestrians, pets, boats, birds
  weather/
    conditions.js         visual presets + WMO code / wind → condition mapping, Beaufort, AQI levels
    service.js            Open-Meteo client
    Atmosphere.js         sun/moon, sky gradient, fog, night emissives
    WeatherFX.js          clouds, rain, splashes, snow, mist, lightning, typhoon vortex, debris
  ui/                     i18n strings, SVG weather icons
```

Each static material is merged into a single draw call, and every agent part is an `InstancedMesh`, so a whole city takes about 30 draw calls.

### Adding a city

Create `src/cities/<id>.js` that exports `{ id, seed, name: {vi, en}, lat, lon, timezone, waterColor, camera, palette, layout(rng), style(rng, ctx) }`, then add it to `src/cities/index.js`.

- `layout()` returns water shapes, hills, parks, roads (bridges are created automatically wherever a road crosses water), walkways, waterways and landmarks.
- `style()` picks a building type for each lot.
