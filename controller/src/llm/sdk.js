// Vercel AI SDK wrapper — used by skills/ for text + structured outputs.
// Kept deliberately small. The existing ollama.js paths (matchRequest,
// pickNextTrack, generateIntro/Link/Hourly/Weather/StationId) still use the
// raw fetch client; we don't migrate those in this pass.

import { generateText, generateObject } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { config } from '../config.js';
import { record } from '../ollama.js';

const provider = createOllama({ baseURL: `${config.ollama.url}/api` });
const model = provider(config.ollama.model);

// Some Ollama models (Qwen 3, DeepSeek R1, etc.) emit a <think>…</think>
// reasoning block before the final answer. The AI SDK doesn't strip these
// for us, so we tell the provider to disable thinking AND strip leftover
// tags defensively — different model families format the wrapper slightly
// differently and not all versions honour `think: false`.
const THINK_TAG_RE = /<think>[\s\S]*?<\/think>\s*/gi;
const DANGLING_THINK_RE = /^[\s\S]*?<\/think>\s*/i;

function stripThinking(s) {
  if (!s) return s;
  return s.replace(THINK_TAG_RE, '').replace(DANGLING_THINK_RE, '').trim();
}

export async function djText({
  system,
  prompt,
  temperature = 0.9,
  topP = 0.95,
  repeatPenalty = 1.15,
  kind = 'sdk.djText',
}) {
  const started = Date.now();
  try {
    const { text } = await generateText({
      model,
      system,
      prompt,
      temperature,
      topP,
      providerOptions: {
        ollama: {
          think: false,
          options: { repeat_penalty: repeatPenalty },
        },
      },
    });
    const out = stripThinking(text);
    record({
      kind, ok: true, ms: Date.now() - started,
      model: config.ollama.model,
      sampling: { temperature, top_p: topP, repeat_penalty: repeatPenalty },
      via: 'ai-sdk',
      systemPreview: system?.slice(0, 200),
      user: prompt,
      response: out,
      t: new Date().toISOString(),
    });
    return out;
  } catch (err) {
    record({
      kind, ok: false, ms: Date.now() - started,
      model: config.ollama.model,
      via: 'ai-sdk',
      user: prompt,
      error: err.message,
      t: new Date().toISOString(),
    });
    throw err;
  }
}

export async function djObject({
  system,
  prompt,
  schema,
  temperature = 0.4,
  kind = 'sdk.djObject',
}) {
  const started = Date.now();
  try {
    const { object } = await generateObject({
      model,
      system,
      prompt,
      schema,
      temperature,
      providerOptions: {
        ollama: { think: false },
      },
    });
    record({
      kind, ok: true, ms: Date.now() - started,
      model: config.ollama.model,
      sampling: { temperature },
      via: 'ai-sdk',
      systemPreview: system?.slice(0, 200),
      user: prompt,
      response: JSON.stringify(object).slice(0, 500),
      t: new Date().toISOString(),
    });
    return object;
  } catch (err) {
    record({
      kind, ok: false, ms: Date.now() - started,
      model: config.ollama.model,
      via: 'ai-sdk',
      user: prompt,
      error: err.message,
      t: new Date().toISOString(),
    });
    throw err;
  }
}
