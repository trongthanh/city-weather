import * as THREE from 'three';
import { RNG, hashString } from '../core/rng.js';
import { MeshBuilder } from '../core/MeshBuilder.js';
import { Path } from '../core/Path.js';
import { Field, Occupancy, HALF, WATER_LEVEL } from './Field.js';
import { buildGround, buildSkirt, buildWater } from './terrain.js';
import { prepareRoads, buildRoads, DECK_Y } from './roads.js';
import { BUILDERS } from './buildings.js';
import { addTree } from './trees.js';
import { LANDMARKS, beachUmbrella } from './landmarks.js';
import { M, buildLightPools } from './materials.js';
import { addLandmarkLighting, buildLandmarkLights } from './landmarkLighting.js';

const FREE = 0, BLOCK = 1, PARK = 2, FOREST = 4;

export function generateCity(def, { lowDetail = false } = {}) {
  const t0 = performance.now();
  const rng = new RNG(def.seed);
  const layout = def.layout(rng.fork('layout'));
  const field = new Field(layout, hashString(def.seed));
  const occ = new Occupancy();
  const B = {
    main: new MeshBuilder('main'), glass: new MeshBuilder('glass'), lit: new MeshBuilder('lit'),
    lamp: new MeshBuilder('lamp'), neon: new MeshBuilder('neon'), foliage: new MeshBuilder('foliage', { sway: true }),
  };
  const pushAll = (x, y, z, ry) => { for (const b of Object.values(B)) b.push(x, y, z, ry); };
  const popAll = () => { for (const b of Object.values(B)) b.pop(); };
  const group = new THREE.Group();
  group.name = def.id;

  // ---- terrain
  const ground = buildGround(field, lowDetail ? 132 : 176);
  group.add(ground.mesh);
  group.add(buildSkirt(field, def.waterColor, 88));
  const water = buildWater(def.waterColor, field);
  group.add(water);

  // ---- occupancy from terrain
  {
    const r = occ.res;
    for (let j = 0; j < occ.n; j++) for (let i = 0; i < occ.n; i++) {
      const x = -HALF + (i + 0.5) * r, z = -HALF + (j + 0.5) * r;
      const k = j * occ.n + i;
      if (Math.abs(x) > HALF - 0.3 || Math.abs(z) > HALF - 0.3) { occ.grid[k] = BLOCK; continue; }
      if (field.islandAt(x, z)) { occ.grid[k] = PARK; continue; }
      if (field.hillHeight(x, z) > 0.06 && field.waterSD(x, z) > 0) { occ.grid[k] = FOREST; continue; }
      if (!field.isFlatLand(x, z, 0.35)) { occ.grid[k] = BLOCK; continue; }
      if (field.inPlaza(x, z)) { occ.grid[k] = BLOCK; continue; }
      if (field.inPark(x, z)) occ.grid[k] = PARK;
    }
  }

  // ---- roads
  const roads = prepareRoads(layout.roads || [], field);
  const trees = [];
  const { walkPaths, lamps } = buildRoads(roads, field, B, occ, rng, trees);

  // ---- extra walkways (promenades) — paved ribbon
  const extraWalks = (layout.walkways || []).map((w) => {
    const path = w.path ? new Path(w.path.points.map((q) => q.clone().setY(0.03)), w.path.closed) : w.ellipse
      ? Path.ellipse(w.ellipse.x, w.ellipse.z, w.ellipse.rx, w.ellipse.rz, { spacing: 0.4, y: 0.03 })
      : Path.fromControl(w.pts, { closed: !!w.closed, smooth: w.smooth !== false, spacing: 0.4, y: 0.03 });
    if (w.paved !== false) {
      const width = w.width || 0.55;
      const n = path.points.length;
      for (let i = 0; i < (path.closed ? n : n - 1); i++) {
        const p = path.points[i], q = path.points[(i + 1) % n];
        B.main.slab(p, q, width, 0.03, w.color || '#ddd3c2');
      }
      for (const p of path.points) occ.markCircle(p.x, p.z, width / 2 + 0.1);
    }
    return { path, walkway: true };
  });

  // ---- landmarks
  const landmarkSpots = [], landmarkPools = [];
  const lmCtx = { rng, field, roads, deckY: DECK_Y + 0.05 };
  for (const L of layout.landmarks || []) {
    const fp = L.footprint;
    if (fp) {
      if (fp.type === 'circle') occ.markCircle(fp.x ?? L.x, fp.z ?? L.z, fp.r, BLOCK);
      else occ.markOBB(fp.x ?? L.x, fp.z ?? L.z, fp.w / 2, fp.d / 2, L.ry || 0, BLOCK);
    }
    const fn = LANDMARKS[L.type];
    if (fn) {
      fn(B, { ...lmCtx, ...L });
      addLandmarkLighting(B, L, landmarkSpots, landmarkPools);
    }
    else console.warn('Unknown landmark', L.type);
  }

  // ---- buildings
  const style = def.style;
  const pal = def.palette;
  let buildingCount = 0;
  const tops = [], roofs = [];
  const stats = {};
  const tryPlace = (spec, cx, cz, yaw) => {
    const hw = spec.w / 2 + 0.03, hd = spec.d / 2 + 0.03;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
      const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
      if (Math.abs(x) > HALF - 0.3 || Math.abs(z) > HALF - 0.3) { stats.edgeFail = (stats.edgeFail || 0) + 1; return false; }
    }
    if (!occ.isFreeOBB(cx, cz, hw - 0.12, hd - 0.12, yaw)) { stats.occFail = (stats.occFail || 0) + 1; return false; }
    occ.markOBB(cx, cz, hw, hd, yaw, BLOCK);
    pushAll(cx, 0, cz, yaw);
    const info = BUILDERS[spec.kind](B, spec, rng, pal) || null;
    if (info && spec.kind !== 'tower') {
      tops.push({ x: cx, y: info.top, z: cz });
      if (info.tin && rng.chance(0.8)) {
        // corrugated tin sun-roof on posts (mái tôn) — dynamic, can be torn off in storms
        const rw = spec.w * 0.96, rd = spec.d * 0.9, py = info.top + 0.47;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.main.cyl(sx * rw * 0.45, info.top, sz * rd * 0.43, 0.025, 0.47, '#6d6d6d', 4);
        roofs.push({ x: cx, y: py, z: cz, w: rw, d: rd, yaw, color: rng.pick(['#7d8f9e', '#4f79a8', '#a35a3c', '#8a9399', '#3f7f6b', '#c0c6ca', '#b5523b']) });
      }
    }
    popAll();
    buildingCount++;
    return true;
  };

  for (const r of roads) {
    if (r.def.frontage === false) continue;
    const { path, hw, sw } = r;
    for (const side of [-1, 1]) {
      if (r.def.frontageSide && r.def.frontageSide !== side) continue;
      let s = rng.range(0, 0.5);
      while (s < path.length) {
        const p = path.pointAt(s), t = path.tangentAt(s);
        if (p.y > 0.1) { s += 0.5; continue; }
        const spec = style(rng, { phase: 'front', x: p.x, z: p.z, road: r });
        if (!spec) { s += 0.8; continue; }
        const fx = t.z * side, fz = -t.x * side; // building front direction (toward road)
        const yaw = Math.atan2(fx, fz);
        let placed = false;
        for (const shrink of [1, 0.72]) {
          const d = spec.d * shrink;
          const off = hw + sw + 0.06 + d / 2;
          const cx = p.x - fx * off + t.x * spec.w / 2, cz = p.z - fz * off + t.z * spec.w / 2;
          if (tryPlace({ ...spec, d }, cx, cz, yaw)) { placed = true; break; }
        }
        s += placed ? spec.w + (spec.gap ?? 0.03) : 0.6;
      }
    }
  }

  // fill pass
  const cands = [];
  for (let z = -HALF + 1; z < HALF - 1; z += 0.9) for (let x = -HALF + 1; x < HALF - 1; x += 0.9) cands.push([x + rng.range(-0.3, 0.3), z + rng.range(-0.3, 0.3)]);
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  const nearestRoad = (x, z) => {
    let best = null;
    for (const r of roads) {
      const n = r.path.nearest(x, z);
      if (!best || n.dist < best.dist) best = { ...n, road: r };
    }
    return best;
  };
  for (const [x, z] of cands) {
    if (occ.get(x, z) !== FREE) continue;
    const nr = nearestRoad(x, z);
    const spec = style(rng, { phase: 'fill', x, z, dist: nr ? nr.dist : 99 });
    if (!spec) continue;
    let yaw = 0;
    if (nr) {
      const p = nr.road.path.points[nr.index];
      const t = nr.road.path.tangents[nr.index];
      const side = Math.sign((x - p.x) * -t.z + (z - p.z) * t.x) || 1;
      yaw = Math.atan2(t.z * side, -t.x * side);
    }
    for (const shrink of [1, 0.8, 0.6]) {
      if (tryPlace({ ...spec, w: spec.w * (shrink < 1 ? 0.85 : 1), d: spec.d * shrink }, x, z, yaw)) break;
    }
  }

  // ---- trees: parks, forest, scatter
  const greens = pal.greens;
  for (const [x, z] of cands) {
    const v = occ.get(x, z);
    let kind = null;
    if (v === PARK && rng.chance(def.parkTreeDensity ?? 0.55)) kind = rng.weighted(def.parkTrees || [['round', 3], ['big', 1], ['yellow', 1]]);
    else if (v === FOREST && rng.chance(0.75)) kind = rng.weighted([['round', 2], ['pine', 2], ['big', 1]]);
    else if (v === FREE && rng.chance(def.scatterTreeDensity ?? 0.35)) kind = rng.weighted(def.scatterTrees || [['round', 3], ['bush', 1]]);
    if (!kind) continue;
    const y = v === FOREST ? field.height(x, z) - 0.05 : 0;
    trees.push({ x, z, y, kind, s: rng.range(0.75, 1.15) * (v === FOREST ? 1.1 : 1) });
    occ.markCircle(x, z, 0.4, BLOCK);
  }
  for (const t of layout.trees || []) trees.push(t);
  for (const t of trees) addTree(B, t, rng, greens);

  // ---- beach furniture
  if (layout.beach) {
    const { coast, width } = layout.beach;
    for (let z = -HALF + 1.5; z < HALF - 1.5; z += 1.25) {
      if (rng.chance(0.25)) continue;
      const x = coast(z) - width * rng.range(0.45, 0.8);
      if (Math.abs(x) > HALF - 0.6 || field.hillHeight(x, z) > 0.1) continue;
      beachUmbrella(B, { x, z, y: field.height(x, z), rng });
    }
  }

  // ---- finalize meshes
  const meshes = {
    main: B.main.build(M.main),
    glass: B.glass.build(M.glass),
    lit: B.lit.build(M.lit, { castShadow: false }),
    lamp: B.lamp.build(M.lamp, { castShadow: false }),
    neon: B.neon.build(M.neon),
    foliage: B.foliage.build(M.foliage),
  };
  for (const m of Object.values(meshes)) if (m) group.add(m);
  if (meshes.foliage) meshes.foliage.customDepthMaterial = M.foliageDepth;
  if (lamps.length) group.add(buildLightPools(lamps));
  const landmarkLights = buildLandmarkLights(landmarkSpots);
  group.add(landmarkLights);
  if (landmarkPools.length) {
    const pools = buildLightPools(landmarkPools, 0.65);
    pools.name = 'landmarkLightPools';
    group.add(pools);
  }

  // ---- agent paths
  const waterPaths = (layout.waterways || []).map((w) => ({
    kind: w.kind || 'boat',
    path: w.ellipse
      ? Path.ellipse(w.ellipse.x, w.ellipse.z, w.ellipse.rx, w.ellipse.rz, { spacing: 0.5, y: WATER_LEVEL })
      : Path.fromControl(w.pts, { closed: !!w.closed, spacing: 0.5, y: WATER_LEVEL }),
  }));

  Object.assign(stats, { buildings: buildingCount, trees: trees.length, ms: Math.round(performance.now() - t0) });
  for (const m of Object.values(meshes)) if (m) stats[m.name] = m.geometry.attributes.position.count;

  return {
    def, group, field, roads, water, occ, landmarkLights,
    walkPaths: [...walkPaths, ...extraWalks],
    roofs, tops,
    beach: layout.beach || null,
    treeSpots: trees.filter((t) => t.kind !== 'bush').map((t) => ({ x: t.x, y: (t.y || 0) + 1.0 * (t.s || 1), z: t.z })),
    waterPaths,
    stats,
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !Object.values(M).includes(o.material)) o.material.dispose?.();
      });
    },
  };
}
