// Pure shared activity policy. Weather values are normalized 0..1 visual parameters.
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const hour = minutes => ((Number.isFinite(minutes) ? minutes : 720) % 1440 + 1440) % 1440 / 60;
const bell = (h, center, spread) => Math.exp(-0.5 * (((h - center) / spread) ** 2));
const wrappedBell = (h, center, spread) => Math.max(bell(h, center, spread), bell(h, center - 24, spread), bell(h, center + 24, spread));
export function activityPolicy(env = {}) {
  const h = hour(env.minutes);
  const rain = clamp(env.rain), wind = clamp(env.wind), waves = clamp(env.waves), flood = clamp(env.flood), snow = clamp(env.snow), fog = clamp(env.fog), lightning = clamp(env.lightning), vortex = clamp(env.vortex);
  const night = clamp(env.night);
  const dangerous = lightning > 0.12 || wind > 0.78 || flood > 0.58 || vortex > 0.12;
  const storm = dangerous || rain > 0.78;
  const morning = wrappedBell(h, 7.5, 1.7);
  const evening = Math.max(0, wrappedBell(h, 19.5, 2.25));
  const deepNight = wrappedBell(h, 2, 1.9);
  const day = Math.max(0.22, 1 - night);
  const weatherLeisure = dangerous ? 0 : (1 - rain * 0.98) * (1 - snow * 0.92) * (1 - fog * 0.72);
  const street = clamp(weatherLeisure * (0.45 + 0.42 * morning + 0.38 * evening + 0.16 * day) * (1 - 0.72 * deepNight));
  const promenade = clamp(weatherLeisure * (0.12 + 0.5 * morning + 0.9 * evening + 0.15 * day) * (1 - 0.9 * deepNight));
  const daylight = clamp(1 - night);
  const beachShoulder = clamp((h - 5.4) / 1.2) * clamp((19.2 - h) / 1.2);
  const beachSafe = beachShoulder > 0.02 && daylight > 0.45 && !dangerous && rain < 0.18 && snow < 0.18 && fog < 0.65 && wind < 0.62 && waves < 0.78 && flood < 0.5;
  const service = beachSafe ? clamp(beachShoulder * (1 - night * 1.4) * (1 - rain * 2) * (1 - snow) * (1 - fog * 0.6)) : 0;
  const travel = clamp((1 - 0.45 * rain - 0.58 * wind - 0.6 * fog - 0.68 * flood) * (dangerous ? (vortex > 0.12 ? 0.04 : 0.16) : 1));
  return { hour: h, morning, evening, deepNight, day, night, rain, wind, waves, flood, snow, fog, lightning, vortex, dangerous, storm, beachSafe, service, street, promenade, travel, weatherLeisure,
    animals: clamp(weatherLeisure * (1 - rain * 0.8) * (dangerous ? 0 : 1)),
    boats: clamp((0.04 + 0.66 * day + 0.16 * morning + 0.18 * evening) * (1 - 0.94 * deepNight) * (1 - waves) * (1 - wind) * (1 - flood) * (1 - snow * 0.9) * (1 - fog * 0.75) * (dangerous ? 0 : 1)),
    beachActivity: beachSafe ? service : 0 };
}
