import { classify } from './conditions.js';

// Realtime weather from Open-Meteo (no API key). Air quality from Open-Meteo Air Quality API.

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const cache = new Map();
const TTL = 10 * 60 * 1000;

export async function fetchWeather(city, { force = false } = {}) {
  const hit = cache.get(city.id);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.data;
  const tz = encodeURIComponent(city.timezone || 'auto');
  const q = `latitude=${city.lat}&longitude=${city.lon}&timezone=${tz}`;
  const fUrl = `${FORECAST}?${q}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&forecast_days=1`;
  const aUrl = `${AIR}?${q}&current=us_aqi,pm2_5`;
  const [f, a] = await Promise.allSettled([getJSON(fUrl), getJSON(aUrl)]);
  if (f.status !== 'fulfilled') throw f.reason;
  const fc = f.value, cur = fc.current, daily = fc.daily;
  const data = {
    fetchedAt: Date.now(),
    utcOffset: fc.utc_offset_seconds ?? 25200,
    time: cur.time,
    temp: cur.temperature_2m,
    feels: cur.apparent_temperature,
    humidity: cur.relative_humidity_2m,
    precip: cur.precipitation,
    code: cur.weather_code,
    cloud: cur.cloud_cover,
    wind: cur.wind_speed_10m,
    windDir: cur.wind_direction_10m,
    gust: cur.wind_gusts_10m,
    isDay: cur.is_day === 1,
    tMin: daily.temperature_2m_min?.[0],
    tMax: daily.temperature_2m_max?.[0],
    sunrise: toMinutes(daily.sunrise?.[0]) ?? 360,
    sunset: toMinutes(daily.sunset?.[0]) ?? 1080,
    uv: daily.uv_index_max?.[0],
    aqi: a.status === 'fulfilled' ? a.value.current?.us_aqi ?? null : null,
    pm25: a.status === 'fulfilled' ? a.value.current?.pm2_5 ?? null : null,
  };
  data.condition = classify({ code: data.code, wind: data.wind, gust: data.gust, precip: data.precip });
  cache.set(city.id, { at: Date.now(), data });
  return data;
}

async function getJSON(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function toMinutes(iso) {
  if (!iso) return null;
  const m = /T(\d\d):(\d\d)/.exec(iso);
  return m ? +m[1] * 60 + +m[2] : null;
}

/** Minutes since local midnight in the city's timezone. */
export function cityMinutesNow(utcOffsetSec = 25200) {
  const now = Date.now() + utcOffsetSec * 1000;
  const d = new Date(now);
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}

export function cityDate(utcOffsetSec = 25200) {
  // A Date whose UTC fields equal the city's wall clock.
  return new Date(Date.now() + utcOffsetSec * 1000);
}
