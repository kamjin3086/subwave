// Context engine — what should the DJ feel like right now?
// Used by the autonomous scheduler to pick mood-appropriate tracks.

import { config } from './config.js';

export function getTimeContext(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 9) return { period: 'early-morning', mood: 'morning', vibe: 'gentle waking', show: 'breakfast' };
  if (h >= 9 && h < 12) return { period: 'morning', mood: 'morning', vibe: 'productive', show: 'morning' };
  if (h >= 12 && h < 14) return { period: 'midday', mood: 'energetic', vibe: 'lunch hour', show: 'midday' };
  if (h >= 14 && h < 17) return { period: 'afternoon', mood: 'focus', vibe: 'sustained energy', show: 'afternoon' };
  if (h >= 17 && h < 19) return { period: 'drive-time', mood: 'driving', vibe: 'drive home', show: 'drive-time' };
  if (h >= 19 && h < 22) return { period: 'evening', mood: 'evening', vibe: 'wind down', show: 'evening' };
  if (h >= 22 || h < 1) return { period: 'late-evening', mood: 'night', vibe: 'late driving', show: 'late' };
  return { period: 'after-hours', mood: 'reflective', vibe: 'after hours', show: 'graveyard' };
}

// Festival calendar — extend as needed.
// Real impl could use a Sikh/UK calendar API; this is good enough to start.
const FESTIVALS = [
  { month: 1, day: 5, name: 'Guru Gobind Singh Jayanti', mood: 'spiritual' },
  { month: 4, day: 13, name: 'Vaisakhi', mood: 'festival', windowDays: 2 },
  { month: 4, day: 14, name: 'Vaisakhi', mood: 'festival' },
  { month: 10, day: 31, name: 'Bandi Chhor Divas', mood: 'festival', windowDays: 2 },
  { month: 11, day: 1, name: 'Diwali', mood: 'festival', windowDays: 3 },
  { month: 12, day: 25, name: 'Christmas', mood: 'celebratory' },
  { month: 12, day: 31, name: 'New Year\'s Eve', mood: 'celebratory' },
];

export function getFestivalContext(date = new Date()) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  for (const f of FESTIVALS) {
    const window = f.windowDays || 0;
    if (f.month === m && Math.abs(f.day - d) <= window) {
      return { name: f.name, mood: f.mood };
    }
  }
  return null;
}

// Weather via Open-Meteo (no API key required)
let weatherCache = { data: null, fetchedAt: 0 };
const WEATHER_TTL_MS = 30 * 60 * 1000;

// Force the next getWeather() call to re-fetch — used when the user changes
// their location in /settings.
export function invalidateWeatherCache() {
  weatherCache = { data: null, fetchedAt: 0 };
}

export async function getWeather() {
  if (weatherCache.data && Date.now() - weatherCache.fetchedAt < WEATHER_TTL_MS) {
    return weatherCache.data;
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${config.weather.lat}&longitude=${config.weather.lng}&current=temperature_2m,weather_code,is_day`;
    const res = await fetch(url);
    const data = await res.json();
    const code = data.current.weather_code;
    const condition = mapWeatherCode(code);
    const result = {
      condition,
      mood: weatherToMood(condition),
      temp: Math.round(data.current.temperature_2m),
      isDay: data.current.is_day === 1,
      location: config.weather.locationName,
    };
    weatherCache = { data: result, fetchedAt: Date.now() };
    return result;
  } catch (err) {
    return { condition: 'unknown', mood: null, temp: null, location: config.weather.locationName };
  }
}

function mapWeatherCode(code) {
  // WMO weather codes simplified
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'foggy';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'snowy';
  if (code >= 80 && code <= 99) return 'stormy';
  return 'cloudy';
}

function weatherToMood(condition) {
  switch (condition) {
    case 'rainy':
    case 'foggy':
    case 'stormy':
      return 'rainy';
    case 'clear':
      return 'sunny';
    case 'snowy':
      return 'reflective';
    default:
      return null;
  }
}

// Combined snapshot — what's the vibe right now?
export async function getFullContext() {
  const time = getTimeContext();
  const weather = await getWeather();
  const festival = getFestivalContext();

  // Festival > weather > time, in that order of priority for mood selection
  const dominantMood = festival?.mood || weather.mood || time.mood;

  return { time, weather, festival, dominantMood };
}
