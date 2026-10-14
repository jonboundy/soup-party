# Soup Party preview assets

Jon chose the cascading soup bowl for the browser icon and the dark “Electric Boogaloo” sequel design for link previews on 2026-10-13.

- `src/app/icon.svg` copies the paths, stroke width and tomato palette from `src/components/home/soup-cascade.tsx`, with a white foot at Jon's request. Its outline switches to cream in dark browser tabs.
- `src/app/favicon.ico` is the same drawing on a cream background at 16, 32, 48 and 64 pixels, for browsers that use the ICO fallback. `src/app/apple-icon.png` is a padded 180-pixel version for home screens.
- `src/app/opengraph-image.png` is the selected 1200 × 630 link preview. Its editable source is `link-preview.html` and `share-bowl.svg` beside this file. Open the HTML at a 1200 × 630 browser viewport and capture it at a device scale factor of 1 to re-export the PNG. The image includes November 21, 2026; update the source and export if the date changes.

Next.js discovers these files automatically. The root layout supplies the production metadata base and the large Twitter card; the homepage supplies the event's Open Graph title and description. Twitter uses the same Open Graph image, so there is one full-size asset to maintain.
