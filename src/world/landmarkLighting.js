import * as THREE from 'three';
import { P } from '../core/MeshBuilder.js';

// A small number of unshadowed architectural spots. Fixtures/windows remain merged,
// and the spots fade with the existing dusk/night lighting rather than adding shadows.
const CONFIG = {
  hcmMausoleum: {
    spots: [-1, 1].map(s => ({ from: [s * 2.6, 0.16, 1.6], to: [s * 2.15, 2.3, 0.02], intensity: 24, distance: 8, angle: 0.65 })),
  },
  stJoseph: {
    spots: [-1, 1].map(s => ({ from: [s * 0.9, 0.12, 2.6], to: [s * 0.62, 1.8, 1.37], intensity: 7, distance: 6, angle: 0.6 })),
  },
  notreDame: {
    spots: [-1, 1].map(s => ({ from: [s * 1.0, 0.12, 3.0], to: [s * 0.58, 2.4, 1.89], intensity: 10, distance: 7, angle: 0.55 })),
  },
  danangCathedral: {
    spots: [-1, 1].map(s => ({ from: [s * 0.65, 0.12, 2.5], to: [s * 0.2, 1.8, 1.56], intensity: 6, distance: 6, angle: 0.6 })),
  },
  operaHouse: {
    // Illuminate both the portico and the rear visible from Hanoi's default viewpoint.
    spots: [
      { from: [-1.4, 0.14, 2.0], to: [-1.3, 0.95, 1.06], intensity: 5, distance: 5, angle: 0.75 },
      { from: [1.4, 0.14, -1.9], to: [0.9, 0.95, -1.36], intensity: 5, distance: 5, angle: 0.75 },
    ],
  },
  cityHall: {
    // The Ho Chi Minh statue in front of City Hall, not the whole plaza.
    spots: [{ from: [0.45, 0.1, 3.15], to: [0, 0.75, 2.2], intensity: 2.5, distance: 3, angle: 0.65 }],
  },
};

/** Add local-space glowing details plus world-space spotlight records. */
export function addLandmarkLighting(B, landmark, spots, pools) {
  const config = CONFIG[landmark.type];
  if (!config) return;
  const { x, z, ry = 0, scale = 1, type } = landmark;
  const frame = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(scale, scale, scale));
  const world = xyz => new THREE.Vector3(...xyz).applyMatrix4(frame);
  for (const b of [B.main, B.lit, B.lamp]) b.pushMatrix(frame);
  for (const spec of config.spots) {
    const [fx, fy, fz] = spec.from;
    B.main.box(fx, fy - 0.1, fz, 0.18, 0.1, 0.16, '#44464a');
    B.lamp.sphere(fx, fy + 0.01, fz, 0.065, '#fff1ce', 0.45, 6);
    spots.push({ landmark: type, position: world(spec.from), target: world(spec.to),
      intensity: spec.intensity * scale * scale, distance: spec.distance * scale, angle: spec.angle });
    pools.push(world([fx, 0.015, fz]));
  }
  if (type === 'stJoseph' || type === 'notreDame') {
    const joe = type === 'stJoseph';
    const tz = joe ? 1.0 : 1.55, tx = joe ? 0.62 : 0.58;
    const wz = joe ? 1.371 : 1.892;
    for (const s of [-1, 1]) {
      B.lit.quad(s * tx, joe ? 2.55 : 2.75, wz, 0.16, 0.42, '#b99865');
      B.lit.quad(s * (tx + (joe ? 0.372 : 0.342)), joe ? 2.55 : 2.75, tz, 0.16, 0.42, '#b99865', s * Math.PI / 2);
    }
    B.lit.put(P.disc(16), '#b99768', { y: joe ? 1.6 : 1.65, z: joe ? 1.366 : 1.841, sx: 0.25, sy: 0.25 });
  } else if (type === 'danangCathedral') {
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      B.lit.quad(s * 0.822, 0.68, -1.8 + i * 0.75, 0.12, 0.46, '#b99865', s * Math.PI / 2);
    }
    B.lit.put(P.disc(16), '#e8d3ad', { y: 1.5, z: 1.566, sx: 0.32, sy: 0.32 });
  } else if (type === 'hcmMausoleum') {
    // Subtle warm illumination in the recessed entrance between the stone columns.
    B.lit.quad(0, 2.0, -0.399, 2.4, 1.55, '#765c39');
  }
  for (const b of [B.main, B.lit, B.lamp]) b.pop();
}

export function buildLandmarkLights(records) {
  const group = new THREE.Group();
  group.name = 'landmarkLighting';
  for (const spec of records) {
    const light = new THREE.SpotLight('#ffe1ad', 0, spec.distance, spec.angle, 0.65, 2);
    light.name = `${spec.landmark}-uplight`;
    light.position.copy(spec.position);
    light.target.position.copy(spec.target);
    light.castShadow = false;
    light.userData.nightIntensity = spec.intensity;
    group.add(light, light.target);
  }
  return group;
}

export function updateLandmarkLights(group, nightLevel) {
  if (!group) return;
  const level = THREE.MathUtils.clamp(nightLevel, 0, 1);
  for (const light of group.children) if (light.isSpotLight) light.intensity = light.userData.nightIntensity * level;
}
