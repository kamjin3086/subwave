"use client";

import { useEffect, useMemo, useState } from "react";
import { turnClass, turnKey, turnText } from "../lib/sessionFeed";

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

// Transcript = what the DJ said on-air, which tracks aired, and the DJ's
// reasoning around each pick. System turns (session start, pick prompts)
// stay filtered out — they're not listener-facing.
const TRANSCRIPT_CLASSES = new Set(["voice", "dj", "track"]);

const MARKER = { voice: "♪", dj: "◇", track: "▶" };

function tickerText(turn) {
  const cls = turnClass(turn);
  const text = turnText(turn);
  return cls === "voice" ? `"${text}"` : text;
}

function Row({ items, duration, direction, opacity, fontSize, paused }) {
  // Tripled so the keyframe can shift one full copy and seamlessly loop.
  const tripled = useMemo(() => [...items, ...items, ...items], [items]);

  return (
    <div className="overflow-hidden" style={{ height: fontSize + 10, opacity }}>
      <div
        className="flex items-center whitespace-nowrap font-mono"
        style={{
          animation: `v3-ticker-${direction} ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
          fontSize,
          lineHeight: 1,
          width: "max-content",
          color: "var(--muted)",
          fontStyle: "normal",
        }}
      >
        {tripled.map((turn, i) => {
          const cls = turnClass(turn);
          return (
            <span
              key={turnKey(turn, i)}
              className="inline-flex items-baseline"
              style={{ padding: "0 28px" }}
            >
              <span style={{ marginRight: 8 }}>{MARKER[cls] || "·"}</span>
              <span>{tickerText(turn)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// `items` is the live session's `messages` array — turns of
// { t, role, kind, text, meta }, oldest first.
export default function BroadcastTicker({ items, enabled }) {
  const [paused, setPaused] = useState(false);
  const isMobile = useIsMobile();

  // Snapshot the feed only when the newest turn changes — otherwise the 5s
  // poll would re-render every tick and visibly restart the marquee.
  const lastT = items && items.length ? items[items.length - 1].t : null;
  const feed = useMemo(() => {
    if (!items?.length) return [];
    return items
      .filter((turn) => TRANSCRIPT_CLASSES.has(turnClass(turn)) && turn.text)
      .slice(-30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastT]);

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
        duration={isMobile ? 270 : 160}
        direction="left"
        opacity={isMobile ? 0.45 : 1}
        fontSize={isMobile ? 12 : 14}
        paused={paused}
      />
    </div>
  );
}
