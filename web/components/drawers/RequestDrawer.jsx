'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const SUCCESS_HOLD_MS = 2800;

// Pull a handful of context-aware suggestion chips out of what's already
// on-air. Each chip carries an attribution so the listener understands why
// it's being offered — "from track", "from time", etc. — instead of a flat
// list of canned moods. Order: most-specific (current track) first, weakest
// (random) last. Capped at 5 so the drawer doesn't sprawl.
function buildSuggestions(nowPlaying, context) {
  const seen = new Set();
  const out = [];
  const push = (text, attribution) => {
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, attribution });
  };

  if (nowPlaying?.artist) {
    // The controller has a dedicated "more like this" code path that picks
    // another song by the currently-playing artist, so attribute it that way
    // — clearer than vague "track-derived".
    push('more like this', `more ${nowPlaying.artist}`);
  }

  const festival = context?.festival?.name;
  if (festival) {
    push(`${festival.toLowerCase()} mood`, `festival`);
  }

  const vibe = context?.time?.vibe || context?.time?.show;
  if (vibe) {
    push(`${vibe} vibes`, `right now`);
  }

  const cond = context?.weather?.condition;
  const weatherMap = {
    clear: 'sunny afternoon',
    sunny: 'sunny afternoon',
    cloudy: 'overcast mood',
    rain: 'rainy day',
    rainy: 'rainy day',
    drizzle: 'rainy day',
    snow: 'snowy night',
    snowy: 'snowy night',
    fog: 'foggy morning',
    foggy: 'foggy morning',
    thunderstorm: 'stormy night',
  };
  if (cond && cond !== 'unknown') {
    push(weatherMap[cond] || `${cond} day`, `weather`);
  }

  // Always-available fallback.
  push('surprise me', `random`);

  return out.slice(0, 5);
}

export default function RequestDrawer({
  requestText, setRequestText,
  requesterName, setRequesterName,
  isSubmitting, onSubmit, onClose,
  nowPlaying, context,
}) {
  const taRef = useRef(null);
  // `result` mirrors the controller response: { success, ack, track, message }.
  // Null while idle; rendered as a success card or inline miss banner.
  const [result, setResult] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleSubmit = async () => {
    const data = await onSubmit();
    if (!data) return;
    setResult(data);
    if (data.success && onClose) {
      // Hold the success card briefly so the listener sees what got queued,
      // then slide the drawer shut and reset for next time.
      closeTimerRef.current = setTimeout(() => {
        onClose();
        // Defer state reset until after the close animation so the form
        // doesn't flash back in during the slide.
        setTimeout(() => setResult(null), 300);
      }, SUCCESS_HOLD_MS);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (result?.success) {
    return <SuccessCard result={result} />;
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginTop: 0 }}>
        Describe a mood, a memory, an artist. Ollama parses it, matches the library,
        and the DJ acknowledges you on-air.
      </p>

      <SuggestionChips
        nowPlaying={nowPlaying}
        context={context}
        onPick={text => { setRequestText(text); taRef.current?.focus(); }}
      />

      <input
        type="text"
        value={requesterName}
        onChange={e => setRequesterName(e.target.value)}
        placeholder="your name (optional)"
        className="w-full v3-focus"
        style={{
          boxSizing: 'border-box',
          border: '1px solid var(--ink)',
          background: 'transparent',
          padding: 10,
          fontSize: 13,
          fontFamily: 'inherit',
          color: 'var(--ink)',
          marginBottom: 8,
        }}
      />

      <textarea
        ref={taRef}
        value={requestText}
        onChange={e => { setRequestText(e.target.value); if (result) setResult(null); }}
        onKeyDown={onKeyDown}
        placeholder='"something for late-night driving"…'
        rows={3}
        className="w-full v3-focus"
        style={{
          resize: 'none',
          boxSizing: 'border-box',
          border: '1px solid var(--ink)',
          background: 'transparent',
          padding: 14,
          fontSize: 16,
          fontFamily: 'inherit',
          color: 'var(--ink)',
          outline: 'none',
        }}
      />

      {result && !result.success && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            border: '1px solid #c0392b',
            background: 'rgba(192, 57, 43, 0.06)',
            color: '#7a2218',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {result.message || 'No match — try different words.'}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !requestText.trim()}
        className="w-full v3-eyebrow v3-focus mt-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          padding: '14px 24px',
        }}
      >
        {isSubmitting ? 'Sending…' : 'Send to the booth'}
      </button>
    </div>
  );
}

function SuccessCard({ result }) {
  const { ack, track, queuePosition } = result;
  return (
    <div
      style={{
        padding: '8px 0',
        animation: 'sw-success-in 240ms ease-out both',
      }}
    >
      <style>{`
        @keyframes sw-success-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          marginBottom: 14,
        }}
      >
        ✓ Queued
      </div>

      {ack && (
        <div
          style={{
            fontSize: 18,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            color: 'var(--ink)',
            lineHeight: 1.3,
            borderLeft: '2px solid var(--accent)',
            paddingLeft: 14,
            marginBottom: 22,
          }}
        >
          “{ack}”
        </div>
      )}

      <div
        style={{
          padding: '16px 0',
          borderTop: '1px solid var(--soft-border)',
          borderBottom: '1px solid var(--soft-border)',
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 6,
          }}
        >
          Now in the booth
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.15, color: 'var(--ink)' }}>
          {track?.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          {track?.artist}
        </div>
      </div>

      {typeof queuePosition === 'number' && queuePosition > 0 && (
        <div
          className="v3-tab-num"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            marginTop: 14,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Position #{queuePosition} in queue
        </div>
      )}

      <div
        style={{
          marginTop: 26,
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        Closing…
      </div>
    </div>
  );
}

// Context-aware chip row. Each chip is a two-line button: the prompt text on
// top, a small attribution caption underneath ("more <artist>", "weather",
// "festival", "right now", "random"). Listeners see *why* a suggestion is
// being offered instead of a flat canned list.
function SuggestionChips({ nowPlaying, context, onPick }) {
  const chips = useMemo(
    () => buildSuggestions(nowPlaying, context),
    [nowPlaying?.artist, nowPlaying?.title, context?.festival?.name,
     context?.time?.vibe, context?.time?.show, context?.weather?.condition]
  );

  return (
    <div className="flex flex-wrap" style={{ gap: 6, margin: '18px 0' }}>
      {chips.map(chip => (
        <button
          key={chip.text}
          onClick={() => onPick(chip.text)}
          className="cursor-pointer v3-focus"
          style={{
            background: 'transparent',
            border: '1px solid var(--ink)',
            color: 'var(--ink)',
            padding: '6px 12px',
            fontFamily: 'inherit',
            textAlign: 'left',
            lineHeight: 1.15,
          }}
          title={`Suggested via ${chip.attribution}`}
        >
          <span style={{ display: 'block', fontSize: 11, letterSpacing: '0.08em' }}>
            {chip.text}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 8,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginTop: 3,
            }}
          >
            {chip.attribution}
          </span>
        </button>
      ))}
    </div>
  );
}
