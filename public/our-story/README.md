Place timeline photos in this folder using:

- `Mmm_YYYY_1` for the first photo
- `Mmm_YYYY_2` for the optional second photo

Examples:

- `Sep_2016_1.png`
- `Sep_2016_2.jpg`
- `Apr_2017_1.PNG`

Supported extensions are `.jpg`, `.jpeg`, and `.png`. Matching is case-insensitive.

Run `npm run generate-gallery` after adding photos, or restart the dev server, so
`public/our-story/manifest.json` is updated. The site renders up to two photos per
Our Story timeline item.
