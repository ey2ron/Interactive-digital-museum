# Final gallery update

This branch combines AlexGaledo's portrait-viewing animation from [PR #1](https://github.com/ey2ron/RVASA2/pull/1) with the completed gallery interface and accessibility updates.

## Animation credit and artwork coverage

- Uses **AlexGaledo's animation and per-artwork viewing approach**, retaining its centered framing. Updated transitions take short wall-safe routes and turn toward only the selected portrait.
- Visits **all 16 artworks**, with one viewing stop for each artwork plus the entrance.
- Places **Second Chance**, portrait 14 in the original PR sequence, at the end after Shimmer and Still Night.
- Preserves original PR commit `a39d9e071e5db7de82c6f80f6567e0a78e3bfe65` in the branch ancestry, with the final adjustments recorded separately.

## Final website behavior

- Guided scrolling moves one portrait per gesture with smooth acceleration and deceleration. First-person free roam uses WASD and mouse look, with wall collision; Escape returns to the nearest fixed portrait view.
- On phones, landscape offers a Free roam button with a left movement joystick, right-side drag to look, and tappable paintings. Portrait orientation returns to guided scrolling.
- Titles and descriptions appear only when directly facing a painting; they stay hidden during camera transitions.
- A compact progress bar provides 17 tiny dot checkpoints, including the entrance. The bar scrolls horizontally on phones and keeps the current stop visible.
- Paintings in the museum and images in the index open an enlarged artwork view with its title, description, credit, and original source.
- Returning from artwork details automatically restores desktop mouse look when it was captured before opening. The artwork index keeps the cursor available until returning to the museum.
- The artwork overlay and descriptions retain transparent backgrounds. Opening and returning use fade animations, with enlargement from the selected painting or thumbnail.
- Clicking the background, using Close, or pressing Escape returns to the index or museum the visitor came from. No extra image zoom controls are included.
- Keyboard and touch controls, useful image alternatives, focus restoration, and reduced-motion collection access remain available.
- All 16 works have descriptions: 14 are labelled Gallery description, and two are attributed publisher adaptations. Research sources and limits are documented in [artwork-descriptions.md](artwork-descriptions.md).

## Validation

- `npm test`: 19 passing tests covering metadata, framing, all checkpoint pairs, wall-safe routes, shortest camera turns, smooth endpoints, collision movement, nearest-portrait selection, and analogue joystick dead zones and speed limits.
- `npm run build`: local production build.
- Browser verification completed for desktop and 320px phone layouts, checkpoint selection, keyboard and touch controls, free roam, clickable paintings, overlay dismissal, fades, and reduced-motion behavior.

## Review and merge

This is the intended final combined website. The original PR commit remains an ancestor, so it can be reviewed as a follow-up after PR #1 or as a combined branch containing both contributors' commits. Other changes to the target branch still need to be checked when merging.
