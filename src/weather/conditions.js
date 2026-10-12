// Visual presets for each weather condition. Every number is 0..1 and gets
// smoothly interpolated so transitions (e.g. sunny -> super typhoon) are continuous.

export const PARAM_KEYS = ['clouds', 'cloudDark', 'rain', 'snow', 'fog', 'wind', 'lightning', 'vortex', 'flood', 'waves', 'sun', 'debris', 'life', 'haze'];

export const CONDITIONS = {
  clear:        { icon: 'clear',   clouds: 0.18, cloudDark: 0,    rain: 0,    snow: 0, fog: 0,    wind: 0.1,  lightning: 0,    vortex: 0,    flood: 0,    waves: 0.05, sun: 1,    debris: 0,   life: 1,    haze: 0.05, sky: ['#7cc3ee', '#cfe9f7'] },
  partly:       { icon: 'partly',  clouds: 0.5,  cloudDark: 0.05, rain: 0,    snow: 0, fog: 0,    wind: 0.15, lightning: 0,    vortex: 0,    flood: 0,    waves: 0.08, sun: 0.85, debris: 0,   life: 1,    haze: 0.08, sky: ['#8dc6e8', '#d5ebf5'] },
  overcast:     { icon: 'cloudy',  clouds: 0.9,  cloudDark: 0.3,  rain: 0,    snow: 0, fog: 0.1,  wind: 0.2,  lightning: 0,    vortex: 0,    flood: 0,    waves: 0.1,  sun: 0.35, debris: 0,   life: 0.95, haze: 0.2,  sky: ['#a7b4bf', '#d8dee3'] },
  fog:          { icon: 'fog',     clouds: 0.55, cloudDark: 0.1,  rain: 0,    snow: 0, fog: 1,    wind: 0.05, lightning: 0,    vortex: 0,    flood: 0,    waves: 0.03, sun: 0.3,  debris: 0,   life: 0.8,  haze: 0.6,  sky: ['#c6cdd1', '#e6e9ea'] },
  drizzle:      { icon: 'drizzle', clouds: 0.85, cloudDark: 0.35, rain: 0.22, snow: 0, fog: 0.2,  wind: 0.2,  lightning: 0,    vortex: 0,    flood: 0,    waves: 0.12, sun: 0.35, debris: 0,   life: 0.9,  haze: 0.3,  sky: ['#9eacb7', '#cfd6db'] },
  rain:         { icon: 'rain',    clouds: 0.95, cloudDark: 0.5,  rain: 0.55, snow: 0, fog: 0.25, wind: 0.32, lightning: 0,    vortex: 0,    flood: 0.05, waves: 0.25, sun: 0.25, debris: 0,   life: 0.72, haze: 0.35, sky: ['#8794a0', '#bcc5cc'] },
  heavyRain:    { icon: 'heavyRain', clouds: 1,  cloudDark: 0.68, rain: 0.95, snow: 0, fog: 0.4,  wind: 0.45, lightning: 0.03, vortex: 0,    flood: 0.3,  waves: 0.4,  sun: 0.15, debris: 0,   life: 0.45, haze: 0.5,  sky: ['#6b7884', '#a2acb4'] },
  thunderstorm: { icon: 'thunder', clouds: 1,    cloudDark: 0.8,  rain: 0.85, snow: 0, fog: 0.3,  wind: 0.55, lightning: 0.35, vortex: 0,    flood: 0.2,  waves: 0.45, sun: 0.12, debris: 0.1, life: 0.4,  haze: 0.45, sky: ['#545f6b', '#8b96a0'] },
  snow:         { icon: 'snow',    clouds: 0.85, cloudDark: 0.15, rain: 0,    snow: 1, fog: 0.3,  wind: 0.15, lightning: 0,    vortex: 0,    flood: 0,    waves: 0.05, sun: 0.4,  debris: 0,   life: 0.6,  haze: 0.35, sky: ['#b7c3cd', '#e8edf1'] },
  storm:        { icon: 'storm',   clouds: 1,    cloudDark: 0.85, rain: 1,    snow: 0, fog: 0.15, wind: 0.8,  lightning: 0.15, vortex: 0.4,  flood: 0.55, waves: 0.75, sun: 0.08, debris: 0.45, life: 0.15, haze: 0.3, sky: ['#4a5560', '#7b8691'] },
  cyclone:      { icon: 'cyclone', clouds: 1,    cloudDark: 1,    rain: 1,    snow: 0, fog: 0.15, wind: 1,    lightning: 0.5,  vortex: 1,    flood: 1,    waves: 1,    sun: 0.03, debris: 1,   life: 0.02, haze: 0.3, sky: ['#2e3640', '#59636d'] },
};

export const CONDITION_ORDER = ['clear', 'partly', 'overcast', 'fog', 'drizzle', 'rain', 'heavyRain', 'thunderstorm', 'storm', 'cyclone', 'snow'];

/** Map WMO weather code + wind (km/h) + precipitation (mm/h) to a condition id. */
export function classify({ code = 0, wind = 0, gust = 0, precip = 0 }) {
  if (wind >= 118 || gust >= 166) return 'cyclone';
  if (wind >= 62 || gust >= 102) return 'storm';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  if ([65, 67, 82].includes(code) || precip >= 7.6) return 'heavyRain';
  if ([61, 63, 66, 80, 81].includes(code) || precip >= 0.5) return 'rain';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([45, 48].includes(code)) return 'fog';
  if (code === 3) return 'overcast';
  if (code === 1 || code === 2) return 'partly';
  return 'clear';
}

/** Beaufort scale (Vietnam uses "cấp gió"). */
export function beaufort(kmh) {
  const t = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118, 134, 150, 167, 184, 202];
  let i = 0;
  while (i < t.length && kmh >= t[i]) i++;
  return i;
}

export function aqiLevel(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50) return { key: 'good', color: '#3fbf5f' };
  if (aqi <= 100) return { key: 'moderate', color: '#e6c229' };
  if (aqi <= 150) return { key: 'usg', color: '#f08a24' };
  if (aqi <= 200) return { key: 'unhealthy', color: '#e5453b' };
  if (aqi <= 300) return { key: 'veryUnhealthy', color: '#8f3f97' };
  return { key: 'hazardous', color: '#7e0023' };
}
