# Background music

The app plays **First Light Particles** by **Yoiyami**, a [soft ambient piano piece](https://opengameart.org/content/first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track) with gentle pads and no percussion. The submission identifies the music as **CC0 1.0 Universal**. The collection credits identify this background track separately from Waneella's artwork and the e.sanchillo music in her full YouTube films.

The optimized local file is `public/assets/audio/first-light-particles-loop.mp3`. Its companion `music-credit.json` records the artist, source/download URLs, license link, edit, duration, default level, size and checksum. No external music player or streaming request is used at runtime.

## Playback

- Audio is requested immediately when the app initializes and plays as soon as it is decoded and the browser allows. It starts independently of the gallery preloader, including reduced-motion and gallery-fallback paths. Audio loading never blocks the gallery.
- A single decoded Web Audio buffer loops continuously. A gain node fades from zero to 20% over 0.8 seconds, including on mobile browsers where media-element volume controls may be limited.
- The sound control starts enabled, including while loading or waiting for browser permission. Its pressed state and speaker icon represent the current on/off choice; `data-playing` separately records actual playback. If browser autoplay policy blocks sound, a visitor gesture can unlock it. Explicit mute cancels queued playback, including a download that finishes later.
- The header's speaker button sits immediately after Free roam. The synchronized collection-header button also remains available in museum artwork details.
- Each fresh page load starts with music enabled. Previous saved mute settings are ignored; manual mute lasts for the current visit. Hidden tabs stop the source and retain its offset; returning resumes only when enabled. Switching between app views does not reset the track.
- Missing or invalid audio stays isolated from gallery navigation. The controls offer retry rather than failing the app.

## Loop preparation and checks

`scripts/prepare-background-music.py` uses the existing temporary FFmpeg installation under `%TEMP%/RVAAnimatedCollection/tools`. The original CC0 WAV stays in `%TEMP%/RVAMusicPreparation/first-light-particles-original.wav`. It trims edge silence, normalizes to -18 LUFS, blends the original tail into its head over two seconds, and rotates the resulting loop to a quiet, low-slope boundary. The final MP3 retains gapless encoder metadata; decoded-buffer looping avoids media-element restart gaps.

The generated metadata records the duration, file size, and decoded seam's maximum channel step on a full-scale range of -1 to 1. Preparation checks the boundary, rejects clipping, and keeps the file below 3 MB. Three repeated boundary excerpts are generated as `%TEMP%/RVAMusicPreparation/three-boundaries.wav` for listening review. The seam is checked digitally; no subjective listening assessment is claimed.

Browser checks confirmed audio activity, gallery/collection mute synchronization and sound-button placement in the gallery, collection and artwork viewer at desktop and 390-pixel phone widths. Automated tests cover automatic initialization independent of gallery loading, blocked autoplay, queued-start cancellation, hidden-tab resume offsets, ignored old mute settings, and network failure.
