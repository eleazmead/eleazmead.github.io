// Matches STORY_IMAGE_EXTS in scripts/generate-gallery-manifest.mjs - keep
// the extension list in sync there, or new extensions will silently be
// filtered out of the manifest before ever reaching this regex.
const STORY_PHOTO_FILENAME_PATTERN = /^([a-z]{3}_\d{4})_([12])\.(jpe?g|png|webp)$/i;

export interface StoryManifestEntry {
  file: string;
  width: number;
  height: number;
}

// Groups manifest entries by their `Mmm_YYYY` prefix, keeping slot order
// (`_1`/`_2`) so callers can address "the first photo" for a chapter.
// Shared by OurStoryComponent and the invitation export feature so the
// filename-parsing rule lives in exactly one place.
export function groupStoryPhotosByPrefix(entries: StoryManifestEntry[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const entry of entries) {
    const match = entry.file.match(STORY_PHOTO_FILENAME_PATTERN);
    if (!match) continue;

    const prefix = match[1].toLowerCase();
    const imageNumber = Number(match[2]);
    const existing = grouped.get(prefix) ?? [];
    existing[imageNumber - 1] = `our-story/${entry.file}`;
    grouped.set(prefix, existing);
  }

  return grouped;
}
