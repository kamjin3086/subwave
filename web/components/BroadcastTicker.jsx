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
  "news",
  "traffic",
  "random-facts",
]);

// AI-reasoning kinds: not spoken on-air, but they're the DJ's "thinking" —
// surface them inline so listeners can see why a track was picked and how a
// request was parsed. ai-pick.meta.reason is the LLM's stated justification;
// intent.message already encodes the parsed intent (`"text" → intent`).
const AI_KINDS = new Set(["ai-pick", "intent", "miss"]);

// Transcript = what was said + which tracks aired + the AI's reasoning around
// each pick. Operational chatter (queued/picker pool stats/scheduler/error)
// stays filtered out.
const TRANSCRIPT_KINDS = new Set([...VOICE_KINDS, ...AI_KINDS, "playing"]);

function aiText(e) {
  if (e.kind === "ai-pick") {
    const reason = e.meta?.reason?.trim();
    const source = e.meta?.source;
    const head = `Picked ${e.message}`;
    if (reason) return `${head} — ${reason}`;
    if (source) return `${head} · via ${source}`;
    return head;
  }
  if (e.kind === "intent") return `Heard ${e.message}`;
  if (e.kind === "miss") return e.message;
  return e.message;
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
        {tripled.map((e, i) => {
          const isVoice = VOICE_KINDS.has(e.kind);
          const isAi = AI_KINDS.has(e.kind);
          const marker = isVoice ? "♪" : isAi ? "◇" : "▶";
          const text = isVoice ? `"${e.message}"` : isAi ? aiText(e) : e.message;
          return (
            <span
              key={`${e.id ?? "x"}-${i}`}
              className="inline-flex items-baseline"
              style={{ padding: "0 28px" }}
            >
              <span style={{ marginRight: 8 }}>{marker}</span>
              <span>{text}</span>
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
    return items.filter(e => TRANSCRIPT_KINDS.has(e.kind)).slice(-30);
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
        duration={isMobile ? 270 : 160}
        direction="left"
        opacity={isMobile ? 0.45 : 1}
        fontSize={isMobile ? 12 : 14}
        paused={paused}
      />
    </div>
  );
}
