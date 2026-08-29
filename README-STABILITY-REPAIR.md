# The Story So Far — Stability Repair

This package contains ONLY the files changed for the stability repair.

Do not replace or delete your existing `data/` folder. Your current `data/library.json` and `data/sources.json` stay exactly where they are so none of the reference images are lost.

Changed files:
- `index.html`
- `styles.css`
- `app.js`
- `sw.js`
- `manifest.webmanifest`
- `icons/icon.svg`

The `sw.js` in this repair intentionally does not cache the app. This prevents old versions of the site from appearing during development.

After copying these files into your existing project folder:
1. Stop the local Python server.
2. Start it again with `python3 -m http.server 8000`.
3. Open `http://localhost:8000`.
4. Hard refresh with Command + Shift + R.

Then test:
- Home
- References
- Open several images
- Pinch zoom and double tap
- Add a finished map
- Save the map
- Confirm it returns to Finished Maps
- Open map
- Edit
- Delete

If this version works, this becomes the next stable GitHub checkpoint.
