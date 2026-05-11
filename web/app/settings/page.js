'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [jingleText, setJingleText] = useState('');
  const [taggerLimit, setTaggerLimit] = useState('50');
  // Mixer settings — local form state, only synced to server on Save
  const [form, setForm] = useState(null);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const refresh = async () => {
    try {
      const r = await fetch(`${API_URL}/settings`);
      const j = await r.json();
      setData(j); setErr(null);
      // Only seed the form once — don't clobber unsaved user edits
      if (!form && j.values) {
        setForm({
          jingleRatio: String(j.values.jingleRatio),
          crossfadeDuration: String(j.values.crossfadeDuration),
          weather: { ...j.values.weather, lat: String(j.values.weather.lat), lng: String(j.values.weather.lng) },
        });
      }
    } catch (e) { setErr(e.message); }
  };

  const saveSettings = async (patch) => {
    setBusy(true); setSaveMsg(null);
    try {
      const r = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      if (j.requiresRestart) setPendingRestart(true);
      setSaveMsg({ tone: 'ok', text: j.requiresRestart ? 'saved — restart the mixer to apply' : 'saved' });
      await refresh();
    } catch (e) {
      setSaveMsg({ tone: 'err', text: e.message });
    } finally { setBusy(false); }
  };

  const restartMixer = async () => {
    if (!confirm('Restart the mixer? Broadcast will drop for ~3-5 seconds.')) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/restart-mixer`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      setPendingRestart(false);
      setSaveMsg({ tone: 'ok', text: 'mixer restarting — give it a few seconds' });
    } catch (e) {
      setSaveMsg({ tone: 'err', text: e.message });
    } finally { setBusy(false); }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  const createJingle = async () => {
    if (!jingleText.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/jingles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jingleText.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      setJingleText('');
      await refresh();
    } catch (e) { alert(`Jingle creation failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const deleteJingle = async (filename) => {
    if (!confirm(`Delete ${filename}?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/jingles/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      await refresh();
    } catch (e) { alert(`Delete failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const toggleAutoPick = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await fetch(`${API_URL}/auto-pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: !data.autoPick }),
      });
      await refresh();
    } finally { setBusy(false); }
  };

  const startTagger = async () => {
    setBusy(true);
    try {
      const limit = parseInt(taggerLimit, 10);
      const r = await fetch(`${API_URL}/tag-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      await refresh();
    } catch (e) { alert(`Tagger start failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-amber-50 font-mono text-sm">
      <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-6">
        <header className="flex flex-wrap items-center gap-3 border-b border-amber-900/40 pb-4">
          <h1 className="text-3xl font-black tracking-tighter">
            SUB<span className="text-amber-500">/</span>WAVE
            <span className="text-amber-200/40 font-normal text-sm ml-3">/settings</span>
          </h1>
          <a href="/" className="text-[10px] tracking-widest uppercase text-amber-500/70 hover:text-amber-300 underline underline-offset-4">← player</a>
          <a href="/debug" className="text-[10px] tracking-widest uppercase text-amber-500/70 hover:text-amber-300 underline underline-offset-4">debug →</a>
          <span className={`ml-auto text-[10px] tracking-widest uppercase flex items-center gap-1 ${err ? 'text-red-400' : 'text-emerald-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${err ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
            {err ? 'down' : 'live'}
          </span>
        </header>

        {err && <Alert tone="err">controller error: {err}</Alert>}
        {!data && !err && <div className="text-amber-200/40 italic">loading…</div>}

        {data && (
          <>
            {/* AUTO-DJ */}
            <Section title="Auto-DJ">
              <Row>
                <div>
                  <div className="text-amber-100">LLM picks next track</div>
                  <div className="text-amber-200/50 text-xs mt-1">
                    When listener queue is empty, Ollama chooses from mood-tagged candidates instead of random shuffle.
                  </div>
                </div>
                <Toggle on={data.autoPick} onChange={toggleAutoPick} disabled={busy} />
              </Row>
              <Row>
                <div>
                  <div className="text-amber-100">Picker status</div>
                  <div className="text-amber-200/50 text-xs mt-1">
                    {data.pickerBusy ? 'Asking Ollama for the next track…' : 'Idle — picks fire on each track change.'}
                  </div>
                </div>
                <span className={`text-[10px] tracking-widest uppercase ${data.pickerBusy ? 'text-amber-400' : 'text-amber-500/40'}`}>
                  {data.pickerBusy ? 'thinking' : 'idle'}
                </span>
              </Row>
              <div className="text-[10px] tracking-widest text-amber-500/40 mt-3">
                model: {data.ollama.model} @ {data.ollama.url}
              </div>
            </Section>

            {/* LIBRARY TAGGER */}
            <Section title="Library mood tags">
              <Row>
                <div>
                  <div className="text-amber-100">
                    {data.libraryStats?.total ?? 0} tracks tagged
                    {data.libraryStats?.updatedAt && (
                      <span className="text-amber-200/50 ml-2 text-xs">
                        · last update {new Date(data.libraryStats.updatedAt).toLocaleString('en-GB')}
                      </span>
                    )}
                  </div>
                  <div className="text-amber-200/50 text-xs mt-1">
                    Walks your Navidrome library album-by-album, sends each track to Ollama for {`{moods, energy}`} classification.
                    Resumable — already-tagged tracks are skipped.
                  </div>
                </div>
              </Row>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] tracking-widest uppercase text-amber-500/60">limit</span>
                <input
                  type="number"
                  min={1}
                  value={taggerLimit}
                  onChange={e => setTaggerLimit(e.target.value)}
                  placeholder="all"
                  disabled={data.tagger.running}
                  className="bg-stone-950/80 border border-amber-900/40 focus:border-amber-500 outline-none px-2 py-1 text-amber-100 w-24 disabled:opacity-40"
                />
                <button
                  onClick={startTagger}
                  disabled={busy || data.tagger.running}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900/40 disabled:cursor-not-allowed text-stone-950 text-[10px] tracking-widest uppercase px-3 py-1.5 font-bold"
                >
                  {data.tagger.running ? 'running…' : 'start tagging'}
                </button>
                {data.tagger.running && data.tagger.startedAt && (
                  <span className="text-[10px] text-amber-200/50">
                    pid {data.tagger.pid} · started {new Date(data.tagger.startedAt).toLocaleTimeString('en-GB')}
                  </span>
                )}
              </div>

              {data.libraryStats?.total > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] tracking-widest text-amber-500/60 uppercase mb-1">by mood</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(data.libraryStats.byMood || {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([m, n]) => (
                        <span key={m} className="border border-amber-900/40 px-2 py-0.5 bg-stone-900/50 text-xs">
                          <span className="text-amber-100">{m}</span>{' '}
                          <span className="text-amber-500/60 tabular-nums">{n}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {data.tagger.lastLog?.length > 0 && (
                <details className="mt-4 border border-amber-900/40 bg-stone-900/40">
                  <summary className="cursor-pointer px-3 py-1.5 text-[10px] tracking-widest uppercase text-amber-500/80">
                    tagger log ({data.tagger.lastLog.length} lines)
                  </summary>
                  <pre className="text-[11px] leading-snug max-h-72 overflow-y-auto whitespace-pre-wrap break-all p-3 text-amber-200/80">
                    {data.tagger.lastLog.join('\n')}
                  </pre>
                </details>
              )}
            </Section>

            {/* JINGLES */}
            <Section title={`Jingles · ${data.jingles.length}`}>
              <div className="text-amber-200/50 text-xs">
                Pre-recorded TTS stingers. One plays for every ~30 music tracks. A default station ident is generated
                on first boot; you can add your own here.
              </div>

              <div className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  value={jingleText}
                  onChange={e => setJingleText(e.target.value)}
                  placeholder='e.g. "You are listening to SUB slash WAVE. Requests open all night."'
                  className="w-full bg-stone-950/80 border border-amber-900/40 focus:border-amber-500 outline-none px-3 py-2 text-amber-100 placeholder:text-amber-200/30"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={createJingle}
                    disabled={busy || !jingleText.trim()}
                    className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900/40 disabled:cursor-not-allowed text-stone-950 text-[10px] tracking-widest uppercase px-3 py-1.5 font-bold"
                  >
                    {busy ? 'generating…' : 'create jingle'}
                  </button>
                  <span className="text-[10px] text-amber-500/40">{jingleText.length}/500 chars · Piper TTS</span>
                </div>
              </div>

              <div className="mt-5 divide-y divide-amber-900/30 border-t border-amber-900/30">
                {data.jingles.length === 0 && (
                  <div className="py-4 text-amber-200/30 italic text-xs">none yet</div>
                )}
                {data.jingles.map(j => (
                  <div key={j.filename} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-amber-100 break-words">{j.text}</div>
                      <div className="text-[10px] text-amber-500/40 mt-1 flex flex-wrap gap-3">
                        <span>{j.filename}</span>
                        <span>{fmtSize(j.size)}</span>
                        {j.createdAt && <span>{new Date(j.createdAt).toLocaleString('en-GB')}</span>}
                        {j.builtin && <span className="text-cyan-400/80">builtin</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteJingle(j.filename)}
                      disabled={busy || j.builtin}
                      title={j.builtin ? "Can't delete the built-in ident" : 'Delete this jingle'}
                      className="text-[10px] tracking-widest uppercase border border-amber-700/60 hover:border-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed text-amber-200 px-2 py-1 shrink-0"
                    >
                      delete
                    </button>
                  </div>
                ))}
              </div>
            </Section>

            {/* MIXER SETTINGS */}
            {form && (
              <Section title="Mixer settings">
                <div className="space-y-4">
                  <FormRow
                    label="Jingle frequency"
                    hint={`1 jingle every N music tracks (current: ${data.values?.jingleRatio})`}
                    requiresRestart
                  >
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={form.jingleRatio}
                      onChange={e => setForm(f => ({ ...f, jingleRatio: e.target.value }))}
                      className="bg-stone-950/80 border border-amber-900/40 focus:border-amber-500 outline-none px-3 py-1.5 text-amber-100 w-28"
                    />
                  </FormRow>

                  <FormRow
                    label="Crossfade duration"
                    hint={`Seconds of overlap between tracks (current: ${data.values?.crossfadeDuration}s)`}
                    requiresRestart
                  >
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={form.crossfadeDuration}
                      onChange={e => setForm(f => ({ ...f, crossfadeDuration: e.target.value }))}
                      className="bg-stone-950/80 border border-amber-900/40 focus:border-amber-500 outline-none px-3 py-1.5 text-amber-100 w-28"
                    />
                    <span className="text-amber-500/50 text-xs ml-2">sec</span>
                  </FormRow>

                  <FormRow
                    label="Weather location"
                    hint={`Used for DJ context + Open-Meteo lookups (current: ${data.values?.weather?.locationName} @ ${data.values?.weather?.lat}, ${data.values?.weather?.lng})`}
                  >
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        placeholder="name"
                        value={form.weather.locationName}
                        onChange={e => setForm(f => ({ ...f, weather: { ...f.weather, locationName: e.target.value } }))}
                        className="bg-stone-950/80 border border-amber-900/40 focus:border-amber-500 outline-none px-3 py-1.5 text-amber-100 w-44"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="lat"
                        value={form.weather.lat}
                        onChange={e => setForm(f => ({ ...f, weather: { ...f.weather, lat: e.target.value } }))}
                        className="bg-stone-950/80 border border-amber-900/40 focus:border-amber-500 outline-none px-3 py-1.5 text-amber-100 w-32"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="lng"
                        value={form.weather.lng}
                        onChange={e => setForm(f => ({ ...f, weather: { ...f.weather, lng: e.target.value } }))}
                        className="bg-stone-950/80 border border-amber-900/40 focus:border-amber-500 outline-none px-3 py-1.5 text-amber-100 w-32"
                      />
                    </div>
                  </FormRow>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-900/30">
                    <button
                      onClick={() => saveSettings({
                        jingleRatio: parseInt(form.jingleRatio, 10),
                        crossfadeDuration: parseFloat(form.crossfadeDuration),
                        weather: {
                          lat: parseFloat(form.weather.lat),
                          lng: parseFloat(form.weather.lng),
                          locationName: form.weather.locationName,
                        },
                      })}
                      disabled={busy}
                      className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900/40 disabled:cursor-not-allowed text-stone-950 text-[10px] tracking-widest uppercase px-3 py-1.5 font-bold"
                    >
                      save settings
                    </button>
                    {pendingRestart && (
                      <button
                        onClick={restartMixer}
                        disabled={busy}
                        className="bg-red-500/90 hover:bg-red-400 disabled:bg-red-900/40 disabled:cursor-not-allowed text-stone-950 text-[10px] tracking-widest uppercase px-3 py-1.5 font-bold"
                      >
                        restart mixer
                      </button>
                    )}
                    {saveMsg && (
                      <span className={`text-xs ${saveMsg.tone === 'err' ? 'text-red-300' : 'text-emerald-300'}`}>
                        {saveMsg.text}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] tracking-wider text-amber-500/40 mt-1">
                    Weather location applies live · Jingle freq + crossfade require a mixer restart
                  </div>
                </div>
              </Section>
            )}

            {/* SYSTEM */}
            <Section title="System">
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <KV k="Ollama" v={`${data.ollama.model} @ ${data.ollama.url}`} />
                <KV k="Weather location" v={data.values?.weather?.locationName} />
              </div>
              <div className="text-amber-200/40 text-xs mt-3 italic">
                DJ persona prompt and voice file are still code-level edits — change <code className="text-amber-300">ollama.js</code> DJ_SYSTEM and the Piper voice in <code className="text-amber-300">.env</code>.
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border border-amber-900/40 bg-stone-900/30">
      <div className="px-4 py-2 border-b border-amber-900/40 bg-amber-950/20">
        <span className="text-[10px] tracking-[0.3em] text-amber-500/80 uppercase">{title}</span>
      </div>
      <div className="p-4 space-y-1">{children}</div>
    </section>
  );
}

function Row({ children }) {
  return <div className="flex items-start justify-between gap-4 py-2">{children}</div>;
}

function FormRow({ label, hint, requiresRestart, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-amber-100 text-sm">{label}</span>
        {requiresRestart && (
          <span className="text-[9px] tracking-widest uppercase text-amber-500/60 border border-amber-900/50 px-1.5 py-0.5">
            restart required
          </span>
        )}
      </div>
      {hint && <div className="text-amber-200/50 text-xs">{hint}</div>}
      <div className="flex items-center flex-wrap">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-12 h-6 transition-colors border ${on ? 'bg-amber-500 border-amber-400' : 'bg-stone-800 border-amber-900/60'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 transition-all ${on ? 'left-6 bg-stone-950' : 'left-0.5 bg-amber-300/80'}`}
      />
    </button>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex gap-2">
      <span className="text-amber-500/60 shrink-0 w-32 uppercase tracking-widest text-[10px]">{k}</span>
      <span className="text-amber-100 break-all">{v}</span>
    </div>
  );
}

function Alert({ tone, children }) {
  return (
    <div className={`border px-3 py-2 ${tone === 'err' ? 'border-red-700/60 bg-red-950/30 text-red-300' : 'border-amber-700/60 bg-amber-950/30 text-amber-200'}`}>
      {children}
    </div>
  );
}

function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
