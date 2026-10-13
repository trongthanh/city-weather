import * as THREE from 'three';
import { geometryFromTris } from '../core/MeshBuilder.js';

const LIT = '#4b5763', DARK = '#46535e';

/** One row of individually occupied office bays on a flat facade, in the builder's frame. */
export function officeWindowRow(B, rng, { face, w, d, y, probability = 0.3, height = 0.3 }) {
  const span = face === 'front' || face === 'back' ? w : d;
  const cols = Math.max(3, Math.floor(span / 0.4));
  const step = (span - 0.16) / cols, ww = step * 0.72;
  for (let i = 0; i < cols; i++) {
    const u = -span / 2 + 0.08 + (i + 0.5) * step;
    let x, z, ry;
    if (face === 'front') { x = u; z = d / 2 + 0.014; ry = 0; }
    else if (face === 'back') { x = -u; z = -d / 2 - 0.014; ry = Math.PI; }
    else if (face === 'right') { x = w / 2 + 0.014; z = -u; ry = Math.PI / 2; }
    else { x = -w / 2 - 0.014; z = u; ry = -Math.PI / 2; }
    const lit = rng.chance(probability);
    (lit ? B.lit : B.glass).quad(x, y, z, ww, height, lit ? LIT : DARK, ry);
  }
}

/** Individual panes conforming to an elliptical, faceted lathe rather than glowing rings. */
export function curvedOfficeWindowRow(B, rng, { x, z, y, radiusAt, profileHeights = [], zScale = 1, segments = 24, probability = 0.3, height = 0.3 }) {
  for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
    // Match LatheGeometry's sin/cos vertices and interpolate within its flat facet.
    const point = (t, yy) => {
      const r = radiusAt(yy) + 0.014;
      return [THREE.MathUtils.lerp(Math.sin(a), Math.sin(b), t) * r,
        yy, THREE.MathUtils.lerp(Math.cos(a), Math.cos(b), t) * r * zScale];
    };
    const bottom = y - height / 2, top = y + height / 2;
    const levels = [bottom, ...profileHeights.filter(h => h > bottom && h < top), top];
    const tris = [];
    // Split at profile bends so glazing never cuts through the curved tower surface.
    for (let k = 0; k < levels.length - 1; k++) {
      const p0 = point(0.15, levels[k]), p1 = point(0.85, levels[k]);
      const p2 = point(0.85, levels[k + 1]), p3 = point(0.15, levels[k + 1]);
      tris.push([p0, p1, p2], [p0, p2, p3]);
    }
    const lit = rng.chance(probability);
    (lit ? B.lit : B.glass).put(geometryFromTris(tris, new THREE.Vector3(0, y, 0)), lit ? LIT : DARK, { x, z }, true);
  }
}
