# RVASA2 — After Hours

A local Three.js gallery driven by scrolling, using the saved RVASA2 model and its evaluated Blender camera animation. No deployment or hosting account is configured.

## Animation and viewing credit

The virtual museum uses **AlexGaledo's animation and per-artwork viewing approach** from [pull request #1](https://github.com/ey2ron/RVASA2/pull/1). The tour provides a centered viewing stop for **all 16 artworks**, with Second Chance (portrait 14 in the original PR sequence) moved to the final stop.

The original PR commit, `a39d9e0`, is preserved in this branch's history. The final website updates are saved in a separate follow-up commit, retaining the original contributor's authorship. The combined version keeps the transparent artwork viewer, descriptions, clickable paintings, fade-in/fade-out animations, free roam, and compact dot checkpoints. See [the final gallery note](docs/final-gallery-note.md) for a review summary.

## Run locally

Open this RVA folder in VS Code. In its terminal:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. Scroll down or up once to move to the next or previous portrait. Navigation retains PR #1's centered portrait framing. Each selection takes a short wall-safe route and makes one smooth turn toward the selected painting, without facing intermediate portraits. Gentle acceleration and deceleration keep scrolling smooth; travel takes 1.5 to 4.6 seconds depending on distance. The tour visits all 16 works and finishes at **Second Chance** (portrait 14 in the original PR sequence), after Shimmer and Still Night. Wheel/trackpad momentum cannot skip stops. The compact bottom bar has seventeen clickable checkpoints: the entrance and all sixteen portraits. Markers are tiny dots, with a lighter dot for the current stop. On smaller screens, swipe or scroll the bar horizontally; the current stop is automatically brought into view. On touchscreens, swipe up or down. Use arrow keys, Page Up/Down, or Space (Shift+Space to go back); Home/End go to the first/last view. The collection button opens twelve animated YouTube scenes with source credits, separate from the museum paintings. Select a collection image or title to open its full film on YouTube. Escape closes the collection. Reduced-motion devices use the artwork index. After editing files, refresh your browser to see the changes.

The **Free roam** button starts first-person exploration: WASD (or arrow keys) moves across the floor, mouse movement looks around, and walls block movement. Click a painting or press E while facing it to open its details. Escape or **Return to nearest portrait** glides to the closest fixed portrait view. Selecting a checkpoint also returns to guided mode. If mouse capture is unavailable, drag the gallery to look around. On phones, portrait orientation uses scrolling mode. Landscape makes the Free roam button available; tapping it enables a left joystick for movement and right-side dragging to look. Tap paintings to open their details. Rotating back to portrait returns to guided scrolling at the nearest portrait. Artwork details release the mouse and pause movement; returning to the museum automatically restores captured mouse look if it was active before opening. The artwork index keeps the mouse available until returning to the museum. Each fresh page load starts in guided mode.

Click/tap a painting in the museum to open its enlarged image, title, description and source links. The museum caption's **View artwork & details** button provides the same action with a keyboard. Previous/next controls and left/right arrows browse artworks. Click the background, use Close, or press Escape to return to the index (or the museum if opened there). Closing the index returns to the museum. The tour pauses while the collection is open.

The index fades in over the museum. Artwork details use a transparent overlay with a softly dimmed, blurred museum behind them; selecting a museum painting enlarges it from its museum position and fades in the description. The image stays at its fitted viewing size. Artwork details and the index fade out before returning to the previous view. Descriptions and museum captions use unboxed text with transparent backgrounds. Reduced-motion preferences disable these opening and closing animations.

## Checks

The collection uses twelve silent MP4 loops with still posters, a pause control, and reduced-motion support. It plays only visible previews and keeps the museum's sixteen paintings and navigation separate. Sources, media details, verification and regeneration instructions are in [the animated collection note](docs/animated-collection.md).

```sh
npm test
npm run build
```

`npm run preview` previews the production build locally on the same port; stop the development server first. No command deploys the site. The site uses a small Node.js server and browser-native modules, with no native build tools required.

## Updating the model later

Save changes in Blender first, then close any export already running. Run the following in PowerShell from this folder:

```powershell
& 'D:\Bleder\blender.exe' --background --disable-autoexec 'D:\Bleder\belender models\RVASA2.blend' --python scripts/export-gallery.py
```

The script reads the saved file in a separate Blender process; it does not save over the source. It samples Gallery_Camera with evaluated constraints, converts its coordinates to match the GLB, combines static architecture and props, bakes their lighting, and exports desktop/mobile GLBs. Baking may take several minutes. The 16 artworks retain their own sharp textures. Exported assets live in `public/assets/`. The export finishes by optimizing the embedded mobile textures.

The subtitle and all 16 artwork credits have a separate emissive glow model, `public/assets/gallery-text-glow.glb`, so the small letters stay sharp over the baked gallery. Its editable Blender scene is `gallery_output/RVASA2_Glow.blend`. To regenerate only that model, run Blender with the glow scene and `scripts/export-gallery-glow.py`. The site loads the glow model alongside the existing desktop and mobile galleries.

The original camera samples remain available for Blender comparisons. Interactive transitions use the PR's per-painting poses with a separate position route and a single shortest quaternion turn toward the destination. A floor collision grid, generated from the gallery geometry, guides both checkpoint flights and first-person movement. Captions appear only when the center of the view hits the painting, and stay hidden during transitions.

The exported tour's `verticalFov` and `referenceAspect` come from the Blender camera's actual render framing. Portrait displays adapt the field of view up to 110 degrees; composition will vary with screen shape.

## Controls and editing

- Change introduction, gallery name, or closing copy in `index.html`.
- Change spacing, colors, or typography in `src/style.css`.
- Per-artwork viewing poses live in `public/assets/stops.json`. After a Blender export, regenerate them with `node scripts/compute-stops.mjs`. The generator preserves every painting and moves Second Chance to the end.
- Every viewing stop becomes a bar checkpoint in `createCheckpoints()` in `src/main.js`. Dragging the scrollbar in guided mode settles at the nearest painting. Flight timing and easing live in `src/navigation.js`; first-person controls live in `src/free-roam.js`.
- After changing the gallery geometry, regenerate its floor collision grid with `node scripts/compute-navigation.mjs` (after regenerating stops). This writes `public/assets/navigation.json` from the desktop GLB and must be included with exported assets.
- `window.galleryTour.setProgress(0.5)` seeks halfway through the viewing sequence. `setStop(0)` through `setStop(16)` seek directly; `goToStop()` animates. `getStop()`, `viewingStops`, normalized `stops`, `getProgress()`, `duration`, and `camera` are available for inspection. The pure `sampleTour()` function retains the raw exported camera timing.
- Artwork data and credits come from `gallery_output/RVASA2_Artwork_Manifest.json` during export.
- Descriptions and image alt text live in `public/assets/artwork-notes.json`, preserved independently of Blender exports. Publisher adaptations link to their source; original gallery text is labelled **Gallery description**. Research details and limitations are in `docs/artwork-descriptions.md`.
- Scene lighting is baked for performance. Glossy reflections and tone mapping may differ from the Cycles render; geometry, route, and evaluated camera gaze are retained.

## Before publishing in the future

Review the tour on your target phone and confirm artwork-use permissions and final copy. Current artwork credits identify Waneella with original source links. The website makes no requests to artwork hosts until a visitor explicitly opens an original source link. All rendering dependencies are served locally; the build copies them into dist/vendor.
