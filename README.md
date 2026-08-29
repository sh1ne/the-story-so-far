# The Story So Far — Companion App

A mobile-first companion web app for **The Story So Far**.

## What it does

- Drawing-reference library organized by category and subcategory
- Search across reference metadata
- Full-screen reference viewer with zoom, pan, and swipe navigation
- Finished Maps gallery
- Take a photo or choose an existing photo
- Title, date, players, and notes for each finished map
- Finished maps stored locally in the browser with IndexedDB
- No login, accounts, server, or cloud database
- Installable as a PWA on supported phones

## Important storage note

Finished Maps are stored only in the browser on the device where they were saved. Clearing browser/site data or losing the device can remove them. They are not uploaded to a server.

## Project structure

```text
index.html
app.js
styles.css
manifest.webmanifest
sw.js
.nojekyll
README.md
ARTWORK-SOURCES.md
data/
  library.json
  sources.json
icons/
  icon.svg
```

## Run locally

Because the app loads JSON and registers a service worker, use a small local web server instead of opening `index.html` directly.

If Python 3 is installed:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

On Windows, the command may be `py -m http.server 8000`.

## GitHub Pages

The repository can be published from the `main` branch and the repository root. The site URL for the repository `sh1ne/the-story-so-far` is:

`https://sh1ne.github.io/the-story-so-far/`

## Adding a reference later

The drawing library is controlled by `data/library.json`. Each category contains subcategories, and each subcategory contains image records. Add another image record to the appropriate `images` array. Keep its Wikimedia/source URL, creator, license, and attribution information with the record.

## Artwork

Artwork source and licensing information is documented in `data/sources.json` and `ARTWORK-SOURCES.md`. The initial library favors public-domain or otherwise reusable Wikimedia Commons material.
