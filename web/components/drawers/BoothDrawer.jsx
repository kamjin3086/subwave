'use client';

import { useMemo, useState } from 'react';
import { turnClass, turnKey, turnText, isDjTurn } from '../../lib/sessionFeed';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'dj', label: 'DJ' },
  { id: 'tracks', label: 'Tracks' },
];

function shortTime(t) {
  try {
    return new Date(t).toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return String(t || '');
  }
}

function classColor(cls) {
  switch (cls) {
    case 'voice': return 'var(--accent)';
    case 'dj':    return 'var(--ink)';
    case 'track': return 'var(--muted)';
    default:      return 'var(--muted)';
  }
}

// `items` is the live session's `messages` array — turns of
// { t, role, kind, text, meta }, oldest first. Shown newest first.
export default function BoothDrawer({ items }) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (!items?.length) return [];
    // System turns (session cues, pick prompts) are operator-facing — never
    // shown on the player. Only voice / dj / track turns reach listeners.
    const ordered = [...items]
      .filter((turn) => turnClass(turn) !== 'system')
      .reverse();
    if (filter === 'all') return ordered;
    return ordered.filter((turn) =>
      filter === 'dj' ? isDjTurn(turn) : turnClass(turn) === 'track');
  }, [items, filter]);

  return (
    <div>
      <div
        className="flex gap-1"
        style={{ padding: '2px 0 14px', borderBottom: '1px solid var(--soft-border)' }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="sw-focus"
              style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--soft-border)'}`,
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            color: 'var(--muted)',
            fontSize: 13,
            lineHeight: 1.6,
            padding: '18px 0',
            fontStyle: 'italic',
          }}
        >
          {items?.length ? 'Nothing in this view.' : 'Booth is quiet. Awaiting transmission…'}
        </div>
      )}

      {filtered.map((turn, i) => {
        const cls = turnClass(turn);
        const isVoice = cls === 'voice';
        const color = classColor(cls);
        const text = turnText(turn);
        return (
          <div
            key={turnKey(turn, i)}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid var(--soft-border)',
              borderLeft: isVoice ? `2px solid var(--accent)` : 'none',
              paddingLeft: isVoice ? 12 : 0,
              marginLeft: isVoice ? -12 : 0,
            }}
          >
            <div className="flex items-baseline gap-2" style={{ marginBottom: 4 }}>
              <span
                className="v3-tab-num"
                style={{ fontSize: 10, color: 'var(--muted)', minWidth: 56 }}
              >
                {shortTime(turn.t)}
              </span>
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color,
                  fontWeight: 600,
                }}
              >
                {turn.kind}
              </span>
            </div>
            <div
              style={{
                fontSize: isVoice ? 14 : 13,
                color: 'var(--ink)',
                fontStyle: isVoice ? 'italic' : 'normal',
                fontFamily: isVoice ? 'Georgia, "Times New Roman", serif' : undefined,
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}
            >
              {isVoice ? `“${text}”` : text}
            </div>
            <MetaLine cls={cls} meta={turn.meta} />
          </div>
        );
      })}
    </div>
  );
}

function MetaLine({ cls, meta }) {
  if (!meta) return null;
  const bits = [];
  const requester = meta.requester || meta.requestedBy;
  if (requester) bits.push(`req by ${requester}`);
  if (cls === 'track' && meta.source) bits.push(`source: ${meta.source}`);
  if (meta.artist || meta.title) {
    bits.push([meta.title, meta.artist].filter(Boolean).join(' — '));
  }
  // A `dj` pick turn can carry the spoken link it wrote (`meta.say`).
  const say = typeof meta.say === 'string' ? meta.say.trim() : '';
  if (!bits.length && !say) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {bits.length > 0 && (
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          {bits.join(' · ')}
        </div>
      )}
      {say && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            lineHeight: 1.4,
            marginTop: 2,
            fontStyle: 'italic',
          }}
        >
          ↳ “{say}”
        </div>
      )}
    </div>
  );
}
