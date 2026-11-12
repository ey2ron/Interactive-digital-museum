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

Open http://127.0.0.1:5173. Scroll down or up once to move to the next or previous portrait. Navigation uses PR #1's centered framing, path-following glides and cubic easing, with travel taking 1.4–4.2 seconds depending on distance. The tour visits all 16 works and finishes at **Second Chance** (portrait 14 in the original PR sequence), after Shimmer and Still Night. Wheel/trackpad momentum cannot skip stops. The compact bottom bar has seventeen clickable checkpoints: the entrance and all sixteen portraits. Markers are tiny dots, with a lighter dot for the current stop. On smaller screens, swipe or scroll the bar horizontally; the current stop is automatically brought into view. On touchscreens, swipe up or down. Use arrow keys, Page Up/Down, or Space (Shift+Space to go back); Home/End go to the first/last view. The collection button opens all 16 works with source credits. Escape closes the collection. Reduced-motion devices use the artwork index. After editing files, refresh your browser to see the changes.

The **Free roam** button restores continuous scrolling along the same camera route, with no automatic checkpoint snapping. Its pressed state means free roam is on; the preference is remembered in this browser. Checkpoints remain available in either mode.

Select any artwork card in the index, or click/tap a painting in the museum, to open its enlarged image, title, description and source links. The museum caption's **View artwork & details** button provides the same action with a keyboard. Previous/next controls and left/right arrows browse artworks. Click the background, use Close, or press Escape to return to the index (or the museum if opened there). Closing the index returns to the museum. The tour pauses while the collection is open.

The index fades in over the museum. Artwork details use a transparent overlay with a softly dimmed, blurred museum behind them; selecting a work enlarges it from its thumbnail or museum position and fades in the description. The image stays at its fitted viewing size. Artwork details and the index fade out before returning to the previous view. Descriptions and museum captions use unboxed text with transparent backgrounds. Reduced-motion preferences disable these opening and closing animations.

## Checks

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

The original camera samples remain available for Blender comparisons. Interactive navigation uses the PR's per-painting poses and follows the sampled path between them, blending small position and gaze corrections near each viewing stop. The final leg follows the path backwards to Second Chance, keeping the route continuous. Scroll progress maps to this complete viewing sequence.

The exported tour's `verticalFov` and `referenceAspect` come from the Blender camera's actual render framing. Portrait displays adapt the field of view up to 110 degrees; composition will vary with screen shape.

## Controls and editing

- Change introduction, gallery name, or closing copy in `index.html`.
- Change spacing, colors, or typography in `src/style.css`.
- Per-artwork viewing poses live in `public/assets/stops.json`. After a Blender export, regenerate them with `node scripts/compute-stops.mjs`. The generator preserves every painting and moves Second Chance to the end.
- Every viewing stop becomes a bar checkpoint in `createCheckpoints()` in `src/main.js`. Dragging the scrollbar in guided mode settles at the nearest painting; free roam has no automatic snapping. Transition duration follows the PR's travel-distance formula in `goToStop()`.
- `window.galleryTour.setProgress(0.5)` seeks halfway through the viewing sequence. `setStop(0)` through `setStop(16)` seek directly; `goToStop()` animates. `getStop()`, `viewingStops`, normalized `stops`, `getProgress()`, `duration`, and `camera` are available for inspection. The pure `sampleTour()` function retains the raw exported camera timing.
- Artwork data and credits come from `gallery_output/RVASA2_Artwork_Manifest.json` during export.
- Descriptions and image alt text live in `public/assets/artwork-notes.json`, preserved independently of Blender exports. Publisher adaptations link to their source; original gallery text is labelled **Gallery description**. Research details and limitations are in `docs/artwork-descriptions.md`.
- Scene lighting is baked for performance. Glossy reflections and tone mapping may differ from the Cycles render; geometry, route, and evaluated camera gaze are retained.

## Before publishing in the future

Review the tour on your target phone and confirm artwork-use permissions and final copy. Current artwork credits identify Waneella with original source links. The website makes no requests to artwork hosts until a visitor explicitly opens an original source link. All rendering dependencies are served locally; the build copies them into dist/vendor.
