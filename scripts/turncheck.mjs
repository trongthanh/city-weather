import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Path } from '../src/core/Path.js';
import { createRoadTurn, distanceAhead, lanePoint } from '../src/agents/RoadTurn.js';

const ctx = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
const { AgentSystem } = await import('../src/agents/AgentSystem.js');
const agents = new AgentSystem(new THREE.Scene());
agents._roadBuckets = new Map();
const env = { rain: 0, wind: 0, night: 0 };
const road = (id, points, hw = 1.2) => ({ id, hw, kind: 'road', path: Path.fromControl(points, { smooth: false }), junctions: [], startEdge: true, endEdge: true });
const from = road(0, [[0, -12], [0, 12]]);
const to = road(1, [[-12, 0], [12, 0]]);
let turns = 0;
for (const name of ['motorbike', 'car', 'bus', 'cyclo']) {
  const T = agents.types[name];
  for (const fromDir of [-1, 1]) for (const toDir of [-1, 1]) for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const plan = createRoadTurn({ from, fromS: 12, fromDir, fromLat: 0.55, to, toS: 12, toDir, toLat: 0.55, vehicleLength: T.spec.len });
    assert.ok(plan);
    const start = lanePoint(from, plan.entryS, fromDir, 0.55);
    const end = lanePoint(to, plan.exitS, toDir, 0.55);
    assert.ok(plan.path.pointAt(0).distanceTo(start) < 1e-6, 'entry position matches lane');
    assert.ok(plan.path.pointAt(plan.path.length).distanceTo(end) < 1e-5, 'exit position matches lane');
    assert.ok(plan.path.tangentAt(0).dot(from.path.tangentAt(plan.entryS).multiplyScalar(fromDir)) > 0.999, 'entry heading matches');
    assert.ok(plan.path.tangentAt(plan.path.length).dot(to.path.tangentAt(plan.exitS).multiplyScalar(toDir)) > 0.999, 'exit heading matches');
    for (const p of plan.path.points) assert.ok(Math.min(from.path.distance(p.x, p.z), to.path.distance(p.x, p.z)) < 1.2, 'turn stays on asphalt');
    const a = { active: true, leaving: false, road: from, path: from.path, dir: fromDir, s: plan.entryS - fromDir * 2,
      lat: 0.55, vmax: 2, v: 2, turnPlan: plan, turn: null, junctionMemory: new Set(), fade: 1, vis: 1,
      off: new THREE.Vector3(), yaw: null, phase: 0, ponchoT: 0.5 };
    let previous = agents._roadPos(a, new THREE.Vector3()), previousYaw = null, seenTurn = false;
    for (let frame = 0; frame < 15 / dt; frame++) {
      agents.setDt(dt);
      agents._updRoad(T, a, dt, env);
      agents._write(T, a, 0, env);
      const p = agents._roadPos(a, new THREE.Vector3());
      assert.ok(p.distanceTo(previous) < 2.2 * dt + 0.002, `${name}: no jump at entry/exit`);
      if (previousYaw != null) {
        const change = Math.abs(Math.atan2(Math.sin(a.yaw - previousYaw), Math.cos(a.yaw - previousYaw)));
        assert.ok(change < 0.3, `${name}: no abrupt heading change`);
      }
      seenTurn ||= !!a.turn;
      previous = p; previousYaw = a.yaw;
      assert.ok(T.parts[0].mesh.instanceMatrix.array.every(Number.isFinite));
      if (seenTurn && !a.turn) break;
    }
    assert.ok(seenTurn && a.road === to && a.dir === toDir, 'completed connector and joined destination');
    turns++;
  }
}
const loop = Path.ellipse(0, 0, 8, 8);
assert.ok(Math.abs(distanceAhead(loop, loop.length - 0.5, 0.5, 1) - 1) < 1e-6, 'closed-road forward seam');
assert.ok(Math.abs(distanceAhead(loop, 0.5, loop.length - 0.5, -1) - 1) < 1e-6, 'closed-road reverse seam');
assert.equal(createRoadTurn({ from, fromS: 12, fromDir: 1, fromLat: 0.5, to: from, toS: 12, toDir: -1, toLat: 0.5 }), null, 'reject sudden U-turn');
// Dead-end junction: select a valid branch before reaching the end, never jump backwards.
const ending = road(2, [[0, -12], [0, 0]]);
ending.junctions.push({ s: ending.path.length, to, toS: 12 });
const approaching = { road: ending, path: ending.path, dir: 1, s: 8, lat: 0.55, junctionMemory: new Set() };
agents._planTurn(agents.types.car, approaching);
assert.ok(approaching.turnPlan, 'plan forced endpoint turn in advance');
const tooLate = { road: ending, path: ending.path, dir: 1, s: 11.9, lat: 0.55, junctionMemory: new Set() };
agents._planTurn(agents.types.car, tooLate);
assert.ok(!tooLate.turnPlan, 'agent already past curve entry never rewinds');
const narrow = road(3, [[-12, 0], [12, 0]], 0.8);
ending.junctions = [{ s: ending.path.length, to: narrow, toS: 12 }];
const bus = { road: ending, path: ending.path, dir: 1, s: 8, lat: 0.55, junctionMemory: new Set() };
agents._planTurn(agents.types.bus, bus);
assert.ok(!bus.turnPlan, 'bus cannot select undersized road');
console.log(`Turn regression checks passed: ${turns} vehicle/direction/frame-rate combinations, position & heading continuity, asphalt bounds and closed-road seams.`);
