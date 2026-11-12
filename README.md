# RVASA2 — After Hours

A local Three.js gallery driven by scrolling, using the saved RVASA2 model and its evaluated Blender camera animation. No deployment or hosting account is configured.

## Run locally

Open this RVA folder in VS Code. In its terminal:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. Scroll down or up to explore. Stopping the scroll settles the camera. The collection button opens all 16 works with source credits. Escape closes the collection. Reduced-motion devices use the artwork index. After editing files, refresh your browser to see the changes.

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

The browser uses sampled camera orientation, so Track To and the final gaze are reproduced without requiring browser constraints. The Blender curve itself is not re-created or re-smoothed. Timing uses `(frame - firstFrame) / fps`; scroll progress maps to those times.

The exported tour's `verticalFov` and `referenceAspect` come from the Blender camera's actual render framing. Portrait displays adapt the field of view up to 110 degrees; composition will vary with screen shape.

## Controls and editing

- Change introduction, gallery name, or closing copy in `index.html`.
- Change spacing, colors, or typography in `src/style.css`.
- Change tour scroll length through `#tour` height (default 1300svh, a 12-viewport travel distance).
- `window.galleryTour.setProgress(0.5)` seeks to the midpoint for comparisons. `getProgress()`, `duration`, and `camera` are available for inspection.
- Artwork data and credits come from `gallery_output/RVASA2_Artwork_Manifest.json` during export.
- Scene lighting is baked for performance. Glossy reflections and tone mapping may differ from the Cycles render; geometry, route, and evaluated camera gaze are retained.

## Before publishing in the future

Review the tour on your target phone and confirm artwork-use permissions and final copy. Current artwork credits identify Waneella with original source links. The website makes no requests to artwork hosts until a visitor explicitly opens an original source link. All rendering dependencies are served locally; the build copies them into dist/vendor.
