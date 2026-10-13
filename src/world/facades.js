import { P } from '../core/MeshBuilder.js';

// Shallow, merged façade details. Every participating material uses the same
// face frame; rotate the detail, not just its pane, on rear/side elevations.
export function facadeWindow(B, { x = 0, z = 0, y, w = 0.28, h = 0.36, ry = 0,
  trim = '#f6edda', glass = '#46535e', lit = true, arched = false, shutter = null }) {
  for (const b of [B.main, B.glass, B.lit]) b.push(x, 0, z, ry);
  const pane = lit ? B.lit : B.glass;
  B.main.quad(0, y, 0.006, w + 0.07, h + 0.07, trim);
  pane.quad(0, y, 0.013, w, h, glass);
  if (arched) {
    B.main.put(P.disc(12), trim, { y: y + h / 2, z: 0.007, sx: w + 0.07, sy: w + 0.07 });
    pane.put(P.disc(12), glass, { y: y + h / 2, z: 0.014, sx: w, sy: w });
  }
  B.main.box(0, y - h / 2 - 0.05, 0.018, w + 0.10, 0.04, 0.035, trim);
  const mullionHeight = h + (arched ? w / 2 : 0);
  B.main.quad(0, y - h / 2 + mullionHeight / 2, 0.023, 0.018, mullionHeight, trim);
  B.main.quad(0, y, 0.023, w, 0.018, trim);
  if (shutter) for (const s of [-1, 1]) {
    B.main.quad(s * (w / 2 + 0.065), y, 0.025, 0.09, h, shutter);
    for (let i = 1; i < 4; i++) B.main.quad(s * (w / 2 + 0.065), y - h / 2 + h * i / 4, 0.030, 0.085, 0.015, trim);
  }
  for (const b of [B.main, B.glass, B.lit]) b.pop();
}

/** Repeat windows around an existing rectangular wall mass, without changing its footprint. */
export function facadeRows(B, { w, d, z = 0, levels, faces = ['front', 'back', 'left', 'right'],
  spacing = 0.62, ww = 0.25, wh = 0.34, trim, glass, arched = false, shutter = null, skip = null }, rng = null) {
  for (const face of faces) {
    const span = face === 'front' || face === 'back' ? w : d;
    const n = Math.max(1, Math.floor((span - 0.12) / spacing));
    for (const y of levels) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * span / n - span / 2;
      if (skip?.({ face, u, y })) continue;
      const frame = { front: [u, z + d / 2, 0], back: [-u, z - d / 2, Math.PI],
        right: [w / 2, z - u, Math.PI / 2], left: [-w / 2, z + u, -Math.PI / 2] }[face];
      facadeWindow(B, { x: frame[0], z: frame[1], ry: frame[2], y, w: ww, h: wh,
        trim, glass, arched, shutter, lit: rng ? rng.chance(0.35) : true });
    }
  }
}
