// Cute, slightly 3D weather icons (inline SVG) matching the art direction.

const defs = `
<defs>
  <radialGradient id="gSun" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff3a6"/><stop offset=".55" stop-color="#ffc83d"/><stop offset="1" stop-color="#f59a1b"/></radialGradient>
  <linearGradient id="gCloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8f1"/></linearGradient>
  <linearGradient id="gCloudDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8c2cc"/><stop offset="1" stop-color="#7d8894"/></linearGradient>
  <linearGradient id="gCloudStorm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f8a96"/><stop offset="1" stop-color="#4a535d"/></linearGradient>
  <radialGradient id="gMoon" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#e9d98f"/></radialGradient>
  <filter id="fSh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#28405a" flood-opacity=".25"/></filter>
</defs>`;

const sun = (cx, cy, r) => {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * (r + 5), y1 = cy + Math.sin(a) * (r + 5);
    const x2 = cx + Math.cos(a) * (r + 12), y2 = cy + Math.sin(a) * (r + 12);
    rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffb627" stroke-width="4.5" stroke-linecap="round"/>`;
  }
  return `<g class="ic-spin" style="transform-origin:${cx}px ${cy}px">${rays}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gSun)" filter="url(#fSh)"/>`;
};
const moon = (cx, cy, r) => `<g filter="url(#fSh)"><path d="M${cx + r * 0.3} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.55} a${r * 0.8} ${r * 0.8} 0 1 1 ${-r * 0.7} ${-r * 1.55}z" fill="url(#gMoon)"/></g>`;
const cloud = (x, y, s, fill = 'url(#gCloud)', cls = 'ic-float') =>
  `<g class="${cls}" transform="translate(${x} ${y}) scale(${s})" filter="url(#fSh)"><path d="M14 46 C2 46 0 30 12 28 C10 14 30 8 38 18 C44 4 70 6 72 24 C86 22 92 38 82 46 Z" fill="${fill}"/></g>`;
const drops = (n, x0, y0, color = '#4aa3df', big = false) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (big ? 12 : 16), y = y0 + (i % 2) * 8;
    s += `<path class="ic-drop" style="animation-delay:${i * 0.18}s" d="M${x} ${y} q-4 7 0 10 q4 -3 0 -10z" fill="${color}"/>`;
  }
  return s;
};
const bolt = (x, y) => `<path class="ic-flash" d="M${x} ${y} l-10 18 h9 l-6 16 l17 -22 h-9 l7 -12z" fill="#ffd23f" stroke="#f0a500" stroke-width="1.5" stroke-linejoin="round"/>`;
const flakes = (n, x0, y0) => { let s = ''; for (let i = 0; i < n; i++) s += `<text class="ic-drop" style="animation-delay:${i * 0.25}s" x="${x0 + i * 16}" y="${y0 + (i % 2) * 8}" font-size="14" fill="#fff" stroke="#9ec5e8" stroke-width=".6">❄</text>`; return s; };
const fogLines = (y) => [0, 1, 2].map((i) => `<line class="ic-fog" style="animation-delay:${i * 0.3}s" x1="${22 + i * 6}" y1="${y + i * 9}" x2="${98 - i * 4}" y2="${y + i * 9}" stroke="#eef2f5" stroke-width="5" stroke-linecap="round" opacity=".95"/>`).join('');
const windLines = (y) => `<g class="ic-wind" stroke="#e8eef4" stroke-width="4" fill="none" stroke-linecap="round"><path d="M8 ${y} h54 a8 8 0 1 0 -8 -8"/><path d="M18 ${y + 12} h66 a9 9 0 1 1 -9 9"/></g>`;
const spiral = () => `<g class="ic-spin-fast" style="transform-origin:60px 50px" filter="url(#fSh)">
  <path d="M60 50 m0 -6 a6 6 0 1 1 -6 6" stroke="#fff" stroke-width="0" fill="none"/>
  <path d="M60 14 C86 14 98 36 90 52 C84 64 70 66 62 60 C76 58 80 44 70 36 C62 30 46 32 40 42" fill="none" stroke="#e8505b" stroke-width="9" stroke-linecap="round"/>
  <path d="M60 86 C34 86 22 64 30 48 C36 36 50 34 58 40 C44 42 40 56 50 64 C58 70 74 68 80 58" fill="none" stroke="#c22d3a" stroke-width="9" stroke-linecap="round"/>
  <circle cx="60" cy="50" r="7" fill="#fff"/></g>`;

export function weatherIcon(kind, night = false) {
  let body = '';
  const celestial = (x, y, r) => (night ? moon(x, y, r * 0.9) : sun(x, y, r));
  switch (kind) {
    case 'clear': body = night ? moon(60, 48, 26) : sun(60, 48, 22); break;
    case 'partly': body = celestial(48, 36, 18) + cloud(28, 32, 0.9); break;
    case 'cloudy': body = cloud(4, 14, 0.75, 'url(#gCloudDark)', 'ic-float2') + cloud(24, 28, 0.95); break;
    case 'fog': body = cloud(20, 6, 0.9) + fogLines(66); break;
    case 'drizzle': body = cloud(18, 6, 0.95, 'url(#gCloudDark)') + drops(4, 34, 66, '#6db6e8'); break;
    case 'rain': body = cloud(18, 4, 0.95, 'url(#gCloudDark)') + drops(5, 30, 62); break;
    case 'heavyRain': body = cloud(18, 2, 0.95, 'url(#gCloudStorm)') + drops(7, 26, 58, '#3c8fd6', true); break;
    case 'thunder': body = cloud(18, 2, 0.95, 'url(#gCloudStorm)') + drops(2, 34, 64) + drops(2, 78, 64) + bolt(64, 52); break;
    case 'snow': body = cloud(18, 6, 0.95) + flakes(4, 30, 74); break;
    case 'storm': body = cloud(22, 0, 0.9, 'url(#gCloudStorm)') + windLines(66) + drops(3, 70, 58); break;
    case 'cyclone': body = spiral(); break;
    default: body = sun(60, 48, 22);
  }
  return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}${body}</svg>`;
}
