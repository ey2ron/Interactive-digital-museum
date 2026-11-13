# Animated collection

The collection contains twelve Waneella YouTube scenes, separate from the sixteen paintings and viewing stops in the 3D museum. Each image/title opens its matching full YouTube video in a new tab. The artist section follows the final preview.

`public/assets/collection-artworks.json` records the YouTube destination, original Tumblr post, original media URL, local MP4/poster, dimensions, excerpt start, duration, visual description, and attribution. All preview media is served locally; browsing the collection does not load YouTube embeds or contact external media hosts.

Previews are silent H.264 MP4s with fast-start metadata, 20 frames per second, preserved aspect ratios, and nearest-neighbour scaling. The build contains 8–12 second excerpts totalling 1,634,507 bytes of video (each approximately 50–214 KB). Nearby videos load as the collection is browsed; only visible previews play. Closing the collection, opening museum artwork details, hiding the tab, or manually pausing stops playback. Reduced-motion visitors start with still posters and can explicitly enable animation. Failed or blocked videos retain their poster and working YouTube link.

## Regeneration

From PowerShell in the project folder, run `./scripts/acquire-collection.ps1`. Its default Python executable is the existing Blender Python; pass `-PythonPath` to use another Python installation with pip. The script installs Pillow and imageio-ffmpeg into `%TEMP%/RVAAnimatedCollection/tools` when needed. Downloaded originals, contact sheets and processing reports also stay under that temporary directory. Only finished media and the collection manifest are written into the site.

The generator uses the original media URLs already recorded in the manifest. It compares candidate start/end frames, selects a closely matching 8–12 second boundary, checks for real frame changes and nonblank posters, and keeps each output below the 2 MB limit. Re-run `npm run build` after regeneration.

## Verification

- All twelve finished videos were decoded to confirm motion and visually inspected through their poster contact sheet.
- The live collection was checked in Edge at desktop width and in a 390-pixel responsive viewport, including pause/resume and the artist/social section.
- Playback tests cover offscreen/closed/hidden states, reduced motion, manual pause persistence, blocked autoplay, media failure, and late playback promises.
- Asset checks verify twelve unique collection works, YouTube links, local MP4/poster files, dimensions, durations and file budgets. Existing museum and navigation tests continue to cover the sixteen gallery works.
