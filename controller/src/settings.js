// Durable settings — overrides for values that have static defaults in code.
// Stored at /var/sub-wave/settings.json. Some apply live (weather location);
// others require a Liquidsoap restart (jingle frequency, crossfade duration).

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SETTINGS_PATH = '/var/sub-wave/settings.json';
const LIQ_SETTINGS_PATH = '/var/sub-wave/liquidsoap_settings.json';

const DEFAULTS = {
  jingleRatio: 30,                    // 1 jingle per N music tracks
  crossfadeDuration: 4.0,             // seconds
  weather: { lat: 52.5862, lng: -2.1288, locationName: 'Wolverhampton' },
};

const BOUNDS = {
  jingleRatio:        { min: 1, max: 1000, type: 'int' },
  crossfadeDuration:  { min: 0, max: 30,   type: 'float' },
};

let cache = null;

export async function load() {
  if (cache) return cache;
  let stored = {};
  if (existsSync(SETTINGS_PATH)) {
    try { stored = JSON.parse(await readFile(SETTINGS_PATH, 'utf8')); } catch {}
  }
  cache = {
    jingleRatio: stored.jingleRatio ?? DEFAULTS.jingleRatio,
    crossfadeDuration: stored.crossfadeDuration ?? DEFAULTS.crossfadeDuration,
    weather: {
      lat: stored.weather?.lat ?? DEFAULTS.weather.lat,
      lng: stored.weather?.lng ?? DEFAULTS.weather.lng,
      locationName: stored.weather?.locationName ?? DEFAULTS.weather.locationName,
    },
  };
  return cache;
}

export function get() {
  return cache || DEFAULTS;
}

// Validate + persist. Returns { saved, requiresRestart } so the UI can react.
export async function update(patch) {
  const cur = await load();
  const next = JSON.parse(JSON.stringify(cur));
  let restart = false;

  if ('jingleRatio' in patch) {
    const v = parseInt(patch.jingleRatio, 10);
    if (!Number.isFinite(v) || v < BOUNDS.jingleRatio.min || v > BOUNDS.jingleRatio.max) {
      throw new Error(`jingleRatio must be int in [${BOUNDS.jingleRatio.min}, ${BOUNDS.jingleRatio.max}]`);
    }
    if (v !== cur.jingleRatio) { next.jingleRatio = v; restart = true; }
  }
  if ('crossfadeDuration' in patch) {
    const v = parseFloat(patch.crossfadeDuration);
    if (!Number.isFinite(v) || v < BOUNDS.crossfadeDuration.min || v > BOUNDS.crossfadeDuration.max) {
      throw new Error(`crossfadeDuration must be number in [${BOUNDS.crossfadeDuration.min}, ${BOUNDS.crossfadeDuration.max}]`);
    }
    if (v !== cur.crossfadeDuration) { next.crossfadeDuration = v; restart = true; }
  }
  if ('weather' in patch) {
    const w = patch.weather || {};
    if (w.lat !== undefined) {
      const v = parseFloat(w.lat);
      if (!Number.isFinite(v) || v < -90 || v > 90) throw new Error('weather.lat out of range');
      next.weather.lat = v;
    }
    if (w.lng !== undefined) {
      const v = parseFloat(w.lng);
      if (!Number.isFinite(v) || v < -180 || v > 180) throw new Error('weather.lng out of range');
      next.weather.lng = v;
    }
    if (typeof w.locationName === 'string' && w.locationName.trim()) {
      next.weather.locationName = w.locationName.trim().slice(0, 80);
    }
  }

  cache = next;
  await writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2));
  await writeLiquidsoapSettings(next);
  return { saved: next, requiresRestart: restart };
}

// Liquidsoap reads two tiny text files instead of JSON — Liquidsoap 2.2.5
// JSON parsing is awkward to type and not worth the effort for two values.
const LIQ_JINGLE_RATIO_PATH = '/var/sub-wave/liquidsoap_jingle_ratio.txt';
const LIQ_CROSSFADE_PATH = '/var/sub-wave/liquidsoap_crossfade.txt';

export async function writeLiquidsoapSettings(s) {
  await writeFile(LIQ_JINGLE_RATIO_PATH, String(s.jingleRatio));
  await writeFile(LIQ_CROSSFADE_PATH, String(s.crossfadeDuration));
}

// Called from server.js startup so the files exist before Liquidsoap reads
// them on its next start. Idempotent.
export async function ensureLiquidsoapSettingsFile() {
  const s = await load();
  if (!existsSync(LIQ_JINGLE_RATIO_PATH) || !existsSync(LIQ_CROSSFADE_PATH)) {
    await writeLiquidsoapSettings(s);
  }
}
