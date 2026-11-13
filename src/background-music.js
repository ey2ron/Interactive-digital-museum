/** One looping source shared by every view; readiness never waits for audio. */
export function createBackgroundMusic({ buttons, statuses, url, doc = document, Context = globalThis.AudioContext || globalThis.webkitAudioContext, fetchAudio = globalThis.fetch }) {
  let enabled = true, ready = false, failed = false, loading = false;
  let context, gain, buffer, source, loadPromise, startedAt = 0, offset = 0;
  const allowed = () => ready && enabled && !doc.hidden && !failed;
  const playing = () => !!source && context?.state === 'running' && allowed();
  function update(message) {
    const audible = playing();
    for (const button of buttons) {
      button.dataset.playing = String(audible);
      button.dataset.enabled = String(enabled);
      button.setAttribute('aria-pressed', String(enabled && !failed));
      const label = failed ? 'Retry music' : enabled ? 'Turn music off' : 'Turn music on';
      button.setAttribute('aria-label', label);
      button.title = failed ? 'Music unavailable — retry' : enabled && !audible ? (loading ? 'Music is loading — turn off' : 'Music starts after interaction — turn off') : label;
    }
    if (message) for (const status of statuses) status.textContent = message;
  }
  function pause() {
    if (source) {
      offset = (offset + Math.max(0, context.currentTime-startedAt)) % buffer.duration;
      const previous = source; source = null; previous.stop();
    }
    if (gain) { gain.gain.cancelScheduledValues(context.currentTime); gain.gain.setValueAtTime(0, context.currentTime); }
    update();
  }
  function fail() {
    failed = true; loading = false; loadPromise = null;
    pause(); update('Music is unavailable. You can retry using the sound button.');
  }
  function startSource() {
    if (!allowed() || !buffer || source) return;
    source = context.createBufferSource();
    source.buffer = buffer; source.loop = true; source.connect(gain);
    startedAt = context.currentTime;
    gain.gain.cancelScheduledValues(startedAt);
    gain.gain.setValueAtTime(0, startedAt);
    gain.gain.linearRampToValueAtTime(.2, startedAt+.8);
    source.start(0, offset);
    update();
  }
  function unlock() {
    if (!context) {
      context = new Context();
      gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
      context.addEventListener('statechange', () => update());
    }
    // A gesture during loading can unlock audio without playing it before readiness.
    if (context.state !== 'running') Promise.resolve(context.resume()).then(() => update()).catch(() => update());
  }
  function attempt() {
    if (!allowed()) return;
    try {
      unlock();
      if (!buffer && !loadPromise) {
        loading = true; update();
        loadPromise = fetchAudio(url).then(response => {
          if (!response.ok) throw new Error('Music download failed');
          return response.arrayBuffer();
        }).then(bytes => context.decodeAudioData(bytes)).then(decoded => {
          buffer = decoded; loading = false; startSource(); update();
        }).catch(fail);
      } else startSource();
    } catch { fail(); }
  }
  for (const button of buttons) button.addEventListener('click', () => {
    if (failed) { failed = false; enabled = true; }
    else enabled = !enabled;
    if (enabled) { attempt(); update('Music enabled.'); }
    else { pause(); update('Music off.'); }
  });
  function interaction(event) {
    if (event.target?.closest?.('[data-music-toggle]') || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (enabled && !playing()) {
      if (ready) attempt();
      else if (!doc.hidden && !failed) { try { unlock(); } catch { fail(); } }
    }
  }
  doc.addEventListener('pointerdown', interaction);
  doc.addEventListener('pointerup', interaction);
  doc.addEventListener('click', interaction);
  doc.addEventListener('keydown', interaction);
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) pause();
    else attempt();
  });
  update();
  return {
    setReady() { if (!ready) { ready = true; attempt(); update(); } },
    getState: () => ({ enabled, ready, failed, loading, playing: playing(), offset })
  };
}
