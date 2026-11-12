# Final gallery update

This branch combines AlexGaledo's portrait-viewing animation from [PR #1](https://github.com/ey2ron/RVASA2/pull/1) with the completed gallery interface and accessibility updates.

## Animation credit and artwork coverage

- Uses **AlexGaledo's animation and per-artwork viewing approach**, including centered framing, eased glides along the camera path, and turns between facing walls.
- Visits **all 16 artworks**, with one viewing stop for each artwork plus the entrance.
- Places **Second Chance**, portrait 14 in the original PR sequence, at the end after Shimmer and Still Night. The final approach follows the camera path backwards continuously.
- Preserves original PR commit `a39d9e071e5db7de82c6f80f6567e0a78e3bfe65` in the branch ancestry, with the final adjustments recorded separately.

## Final website behavior

- Guided scrolling moves one portrait per gesture; free roam allows continuous scrolling.
- A compact progress bar provides 17 tiny dot checkpoints, including the entrance. The bar scrolls horizontally on phones and keeps the current stop visible.
- Paintings in the museum and images in the index open an enlarged artwork view with its title, description, credit, and original source.
- The artwork overlay and descriptions retain transparent backgrounds. Opening and returning use fade animations, with enlargement from the selected painting or thumbnail.
- Clicking the background, using Close, or pressing Escape returns to the index or museum the visitor came from. No extra image zoom controls are included.
- Keyboard and touch controls, useful image alternatives, focus restoration, and reduced-motion collection access remain available.
- All 16 works have descriptions: 14 are labelled Gallery description, and two are attributed publisher adaptations. Research sources and limits are documented in [artwork-descriptions.md](artwork-descriptions.md).

## Validation

- `npm test`: 13 passing tests covering artwork metadata, centered framing, all 16 tour stops, continuity in both directions, and progress alignment.
- `npm run build`: local production build.
- Browser verification completed for desktop and 320px phone layouts, checkpoint selection, keyboard and touch controls, free roam, clickable paintings, overlay dismissal, fades, and reduced-motion behavior.

## Review and merge

This is the intended final combined website. The original PR commit remains an ancestor, so it can be reviewed as a follow-up after PR #1 or as a combined branch containing both contributors' commits. Other changes to the target branch still need to be checked when merging.
