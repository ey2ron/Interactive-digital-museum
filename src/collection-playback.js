/** Only visible collection previews play; closed/hidden views never keep decoding. */
export function createCollectionPlayback({ root, toggle, status, reducedMotion = false, doc = document, Observer = IntersectionObserver }) {
  const items = new Map();
  let active = false, paused = reducedMotion;
  const eligible = item => active && !doc.hidden && !paused && item.visible && !item.failed;
  function updateButton() {
    toggle.textContent = paused ? 'Play animations' : 'Pause animations';
    toggle.setAttribute('aria-pressed', String(paused));
  }
  function sync() {
    for (const item of items.values()) {
      const { video } = item;
      if (active && !doc.hidden && !paused && item.near && !item.loaded && !item.failed) {
        video.src = item.source;
        video.load();
        item.loaded = true;
      }
      if (!eligible(item) || !item.loaded) {
        if (item.requested) { item.request++; item.requested = false; }
        video.pause();
        continue;
      }
      if (item.requested) continue;
      item.requested = true;
      const request = ++item.request;
      const blocked = () => {
        if (request !== item.request || !eligible(item)) return;
        video.hidden = true;
        paused = true;
        status.textContent = 'Animations are paused. Select Play animations to try again, or open a scene on YouTube.';
        updateButton(); sync();
      };
      try {
        Promise.resolve(video.play()).then(() => {
          if (!eligible(item)) video.pause();
          else if (request === item.request) video.hidden = false;
        }).catch(blocked);
      } catch { blocked(); }
    }
  }
  const nearby = new Observer(entries => {
    for (const entry of entries) items.get(entry.target).near = entry.isIntersecting;
    sync();
  }, { root, rootMargin: '180px 0px' });
  const visible = new Observer(entries => {
    for (const entry of entries) items.get(entry.target).visible = entry.isIntersecting && entry.intersectionRatio >= .1;
    sync();
  }, { root, threshold: [0, .1] });
  toggle.addEventListener('click', () => {
    paused = !paused;
    status.textContent = paused ? 'Animations paused.' : 'Animations playing as you browse.';
    updateButton(); sync();
  });
  doc.addEventListener('visibilitychange', sync);
  updateButton();
  return {
    add(video, source, surface) {
      const item = { video, source, near: false, visible: false, loaded: false, requested: false, request: 0, failed: false };
      items.set(surface, item);
      video.addEventListener('error', () => {
        item.failed = true; item.request++;
        video.pause(); video.hidden = true;
        status.textContent = 'A preview is unavailable. You can still open the full artwork on YouTube.';
      });
      nearby.observe(surface); visible.observe(surface);
    },
    setActive(value) { active = value; sync(); }
  };
}
