import hanoi from './hanoi.js';
import danang from './danang.js';
import hcmc from './hcmc.js';

// Add a new city: create a module exporting { id, name, lat, lon, layout(rng), style(rng, ctx), ... }
// and append it here. Everything else (terrain, roads, buildings, traffic, weather) is generic.
export const CITIES = [hanoi, danang, hcmc];
export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[0];
