import { BASE_PALETTE } from './palettes.js';

// TP. Hồ Chí Minh — Landmark 81, Bitexco, Nhà thờ Đức Bà, Bưu điện, UBND & phố đi bộ Nguyễn Huệ,
// chợ Bến Thành, sông Sài Gòn, kênh Bến Nghé, cầu Thủ Thiêm 2, cầu Khánh Hội, Bến Nhà Rồng.

const RIVER = [[15.6, -24], [16.8, -12], [15.9, -2], [16.6, 8], [17.6, 14], [24, 19.5]];
const CANAL = [[-24, 16.9], [0, 16.6], [12, 16.7], [17.4, 16.1]];

export default {
  id: 'hcmc',
  seed: 'sai-gon-1975',
  name: { vi: 'TP. Hồ Chí Minh', en: 'Ho Chi Minh City' },
  title: { vi: 'Thành phố Hồ Chí Minh', en: 'Ho Chi Minh City' },
  lat: 10.7769, lon: 106.7009,
  timezone: 'Asia/Ho_Chi_Minh',
  waterColor: '#6aaec4',
  camera: { azimuth: 20, elevation: 38, span: [58, 54], targetY: 12.5 },
  palette: { ...BASE_PALETTE, tileRoof: 0.35 },
  parkTreeDensity: 0.85,
  scatterTreeDensity: 0.6,
  parkTrees: [['round', 3], ['big', 2], ['flame', 1], ['palm', 0.6], ['yellow', 0.6]],
  scatterTrees: [['round', 3], ['big', 1], ['bush', 1]],

  layout(rng) {
    const trees = [];
    for (let z = -7; z <= 11.5; z += 2.2) {
      if (Math.abs(z - 2) < 1.8 || Math.abs(z - 7.5) < 1.2) continue;
      trees.push({ x: 0.95, z, kind: 'round', s: 0.75 }, { x: 5.05, z, kind: 'round', s: 0.75 });
    }
    for (const [tx, tz] of [[-14.0, -11.5], [-6.5, -11.5], [-14.0, -0.4], [-6.5, -0.4], [-14.1, -15.6], [-6.4, -15.6], [-14.1, -20.6], [-6.4, -20.6]]) trees.push({ x: tx, z: tz, kind: 'round', s: 0.75 });
    return {
      water: [
        { type: 'river', points: RIVER, width: 6.4, wobble: 0.2 },
        { type: 'river', points: CANAL, width: 3.2 },
      ],
      parks: [
        { type: 'rect', x: 21, z: 0, w: 5, d: 44 },
        { type: 'rect', x: 4, z: 20.3, w: 28, d: 3.4 },        // canal-side park (east part)
        { type: 'rect', x: -19.3, z: -5.6, w: 5.0, d: 14.6 },   // Công viên Tao Đàn
        { type: 'rect', x: 13.0, z: -2.0, w: 2.2, d: 34 },      // Bến Bạch Đằng riverside
        { type: 'rect', x: 7.6, z: 7.6, w: 3.6, d: 8.4 },       // pocket park by the river (was Bitexco)
        { type: 'rect', x: -10.25, z: 8.1, w: 8.4, d: 8.6 },    // gardens around Bitexco
      ],
      plazas: [
        { x: 3, z: 2.2, w: 4.6, d: 19.4 },
        { x: 3, z: -5.7, w: 11.8, d: 12.2 },        // open civic block: City Hall + Uncle Hồ statue
        { x: -10.25, z: -18.0, w: 8.4, d: 6.6 },   // Công xã Paris square around Nhà thờ Đức Bà
        { x: -10.25, z: -5.75, w: 8.4, d: 12.0 },   // forecourt around chợ Bến Thành
      ],
      roads: [
        { name: 'Tôn Đức Thắng → Cầu Khánh Hội', pts: [[10.6, -22], [10.6, 22]], smooth: false, hw: 1.2, trees: 2.4, frontageSide: 1 },
        { name: 'Võ Văn Kiệt', pts: [[-22, 13.6], [10.6, 13.6]], smooth: false, hw: 1.2, trees: 2.6, frontageSide: 1 },
        { name: 'Lê Duẩn', pts: [[-22, -13.5], [10.6, -13.5]], smooth: false, hw: 1.15, trees: 2.6 },
        { name: 'Lê Lợi', pts: [[-22, 2], [10.6, 2]], smooth: false, hw: 1.15, trees: 2.6 },
        { name: 'Đồng Khởi', pts: [[-4.5, -22], [-4.5, 13.6]], smooth: false, hw: 1.0, trees: 2.8 },
        { name: 'Pasteur', pts: [[-16, -22], [-16, 13.6]], smooth: false, hw: 1.0, trees: 2.8 },
        { name: 'Thủ Thiêm 2', pts: [[10.6, -6.5], [22, -6.5]], smooth: false, hw: 1.15, frontage: false },
      ],
      walkways: [
        { pts: [[1.6, -7.4], [1.6, 11.8]], smooth: false, paved: false },
        { pts: [[4.4, -7.4], [4.4, 11.8]], smooth: false, paved: false },
        { pts: [[13.4, -21], [13.6, -12], [13.1, -2], [13.4, 8], [14.0, 13.2]], width: 0.5, color: '#d8cfbf' },
      ],
      landmarks: [
        { type: 'canalRow', x0: -21.4, x1: -8.6, z: 20.3 },
        { type: 'landmark81', x: 3.2, z: -18.2, footprint: { type: 'rect', w: 5.6, d: 5.6 } },
        // The former civic-block skyscraper, with its original dimensions/appearance.
        { type: 'officeTower', x: -19.5, z: -18.3, ry: Math.PI / 2,
          w: 2.8792218208312987, d: 3.1312400457449256, floors: 19, seed: 377477148,
          footprint: { type: 'rect', w: 3.6, d: 3.8 } },
        { type: 'bitexco', x: -10.4, z: 7.8, footprint: { type: 'rect', w: 5.8, d: 4.0, x: -9.5 } },
        { type: 'notreDame', x: -11.0, z: -18.3, ry: Math.PI / 2, footprint: { type: 'rect', w: 3.0, d: 7.2, x: -10.7 } },
        { type: 'postOffice', x: -1.55, z: -18.3, ry: -Math.PI / 2, footprint: { type: 'rect', w: 6.0, d: 2.4, x: -1.65 } },
        // Full civic-square frontage; keep the statue/promenade south of the steps.
        { type: 'cityHall', x: 3.0, z: -9.6, ry: 0, footprint: { type: 'rect', w: 11.7, d: 2.4, z: -9.5 } },
        { type: 'benThanh', x: -10.25, z: -6.7, ry: 0, w: 6.8, d: 7.6, footprint: { type: 'rect', w: 7.2, d: 9.6, z: -6.1 } },
        { type: 'fountain', x: 3.0, z: 7.5 },
        { type: 'thuThiemBridge', px: 12.9, z: -6.5, dir: 1 },
        { type: 'khanhHoiBridge', x: 10.6, z0: 14.4, z1: 18.6 },
        { type: 'nhaRong', x: 15.1, z: 20.0, ry: Math.PI, scale: 1.2, footprint: { type: 'rect', w: 5.5, d: 3.6 } },
      ],
      trees,
      waterways: [
        { kind: 'boat', pts: RIVER.map(([x, z]) => [x - 0.9, z]) },
        { kind: 'boat', pts: RIVER.map(([x, z]) => [x + 1.0, z]) },
        { kind: 'boat', pts: CANAL.map(([x, z]) => [x, z]) },
      ],
    };
  },

  style(rng, { phase, x, z }) {
    // No procedural infill inside the City Hall / statue block.
    if (x > -4.5 && x < 10.6 && z > -13.5 && z < 2) return null;
    // Bitexco's block stays open (tower + trees)
    if (x > -14.5 && x < -6 && z > 3 && z < 12.6) return null;
    const old = x < -16.5;
    // south-west corner (south of Công viên 23/9): dense old shophouses
    if ((old && z > 7) || (z > 18.6 && x < -8)) return phase === 'front' || rng.chance(0.85)
      ? { kind: 'tube', w: rng.range(1.2, 1.8), d: rng.range(1.8, 2.7), floors: rng.int(2, 5), gap: 0.02 }
      : null;
    const cbd = z < -1 || (x > 5 && x < 12);
    if (phase === 'front') {
      if (old) return { kind: 'tube', w: rng.range(1.2, 1.8), d: rng.range(2.1, 2.9), floors: rng.int(2, 5), gap: 0.02 };
      if (cbd && z < -1 && rng.chance(0.2)) return { kind: 'tower', w: rng.range(2.8, 3.6), d: rng.range(2.8, 3.4), floors: rng.int(14, 28), gap: 0.8 };
      if (rng.chance(0.35)) return { kind: 'villa', w: rng.range(2.4, 3.2), d: rng.range(2.4, 3.0), floors: rng.int(2, 3), gap: 0.25 };
      return { kind: 'midrise', w: rng.range(2.2, 3.4), d: rng.range(2.2, 3.2), floors: rng.int(4, 10), gap: 0.15 };
    }
    if (rng.chance(0.4)) return null;
    if (old) return { kind: 'tube', w: rng.range(1.3, 2.0), d: rng.range(1.6, 2.4), floors: rng.int(2, 4) };
    if (cbd && rng.chance(0.06)) return { kind: 'tower', w: rng.range(2.6, 3.2), d: rng.range(2.6, 3.2), floors: rng.int(12, 22) };
    return { kind: 'midrise', w: rng.range(2.0, 3.0), d: rng.range(2.0, 3.0), floors: rng.int(4, 9) };
  },
};
