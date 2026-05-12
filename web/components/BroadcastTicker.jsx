"use client";

import { useEffect, useMemo, useState } from "react";

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setM(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return m;
}

const VOICE_KINDS = new Set([
  "dj-speak",
  "station-id",
  "link",
  "hourly-check",
  "weather",
]);

function shortTime(t) {
  try {
    return new Date(t).toLocaleTimeString("en-GB", { hour12: false });
  } catch {
    return "";
  }
}

function Row({ items, duration, direction, opacity, fontSize, paused }) {
  // Tripled so the keyframe can shift one full copy and seamlessly loop.
  const tripled = useMemo(() => [...items, ...items, ...items], [items]);

  return (
    <div className="overflow-hidden" style={{ height: fontSize + 10, opacity }}>
      <div
        className="flex items-center whitespace-nowrap"
        style={{
          animation: `v3-ticker-${direction} ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
          fontSize,
          lineHeight: 1,
          width: "max-content",
        }}
      >
        {tripled.map((e, i) => {
          const isVoice = VOICE_KINDS.has(e.kind);
          const reason = e.meta?.reason;
          return (
            <span
              key={`${e.id ?? "x"}-${i}`}
              className="inline-flex items-baseline"
              style={{ padding: "0 28px" }}
            >
              <span style={{ color: "var(--muted)", marginRight: 10 }}>
                {shortTime(e.t)}
              </span>
              <span
                style={{
                  color: isVoice ? "var(--accent)" : "var(--muted)",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontSize: Math.max(9, fontSize - 4),
                  marginRight: 10,
                  fontWeight: 600,
                }}
              >
                {e.kind}
              </span>
              <span style={{ color: "var(--muted)", marginRight: 8 }}>›</span>
              <span
                style={{
                  color: "var(--ink)",
                  fontStyle: isVoice ? "italic" : "normal",
                  fontFamily: isVoice
                    ? 'Georgia, "Times New Roman", serif'
                    : undefined,
                }}
              >
                {isVoice ? `“${e.message}”` : e.message}
              </span>
              {reason && (
                <>
                  <span style={{ color: "var(--muted)", margin: "0 8px" }}>↳</span>
                  <span
                    style={{
                      color: "var(--muted)",
                      fontStyle: "italic",
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}
                  >
                    {reason}
                  </span>
                </>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function BroadcastTicker({ items, enabled }) {
  const [paused, setPaused] = useState(false);
  const isMobile = useIsMobile();

  // Snapshot the feed only when the newest id changes — otherwise the 5s poll
  // would re-render every tick and visibly restart the marquee.
  const lastId = items && items.length ? items[items.length - 1].id : null;
  const feed = useMemo(() => {
    if (!items?.length) return [];
    return items.slice(-30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  if (!enabled || feed.length === 0) return null;

  return (
    <div
      className="flex-1 min-w-0 relative"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0, black 60px, black calc(100% - 60px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 60px, black calc(100% - 60px), transparent 100%)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-hidden="true"
    >
      <Row
        items={feed}
        duration={isMobile ? 540 : 320}
        direction="left"
        opacity={isMobile ? 0.45 : 1}
        fontSize={isMobile ? 12 : 14}
        paused={paused}
      />
    </div>
  );
}
