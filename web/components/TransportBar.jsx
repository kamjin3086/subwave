'use client';

import BroadcastTicker from './BroadcastTicker';

export default function TransportBar({
  tunedIn,
  onTune,
  volume,
  setVolume,
  nowPlaying,
  elapsed,
  djLog,
  tickerOn,
}) {
  const duration = nowPlaying?.duration ?? 0;
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const cells = 12;
  const lit = Math.round(volume * cells);

  const showTicker = tickerOn && djLog?.length > 0;
  const songLine = nowPlaying?.title
    ? `${nowPlaying.title}${nowPlaying.artist ? ' · ' + nowPlaying.artist : ''}`
    : null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20"
      style={{ borderTop: '1px solid var(--ink)', background: 'var(--bg)' }}
    >
      {/* Hairline progress along the top edge of the bar. */}
      {duration > 0 && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: 0,
            height: 2,
            width: `${progress * 100}%`,
            background: 'var(--accent)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      <div className="flex items-center gap-3 sm:gap-6 px-4 py-3 sm:px-8 sm:py-5">
        <button
          onClick={onTune}
          className="v3-eyebrow v3-focus cursor-pointer flex items-center gap-[10px] shrink-0 px-4 py-3 sm:px-7 sm:py-[14px]"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            border: 'none',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tunedIn ? 'var(--accent)' : '#5a5048',
              display: 'inline-block',
            }}
          />
          {tunedIn ? 'Tune Out' : 'Tune In'}
        </button>

        {showTicker ? (
          <BroadcastTicker items={djLog} enabled={true} />
        ) : (
          <div
            className="flex-1 min-w-0 v3-caption truncate"
            style={{ color: 'var(--muted)' }}
            title={songLine ?? ''}
          >
            {songLine && (
              <>
                <span style={{ color: 'var(--ink)' }}>{nowPlaying.title}</span>
                {nowPlaying.artist && <> · {nowPlaying.artist}</>}
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-[10px] shrink-0">
          <span className="hidden sm:inline v3-caption" style={{ color: 'var(--muted)' }}>Vol</span>
          <div
            className="relative flex items-center w-[52px] sm:w-[80px]"
            style={{ height: 18, gap: 2 }}
          >
            {Array.from({ length: cells }).map((_, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: '100%',
                  background: i < lit ? 'var(--ink)' : 'transparent',
                  border: '1px solid var(--ink)',
                }}
              />
            ))}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
