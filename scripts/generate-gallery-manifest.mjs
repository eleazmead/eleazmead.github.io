import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { imageSize } from 'image-size';

const galleryDir = 'public/gallery';
const ourStoryDir = 'public/our-story';
const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif|avif)$/i;
const STORY_IMAGE_EXTS = /\.(jpg|jpeg|png|webp)$/i;

if (!existsSync(galleryDir)) mkdirSync(galleryDir, { recursive: true });
if (!existsSync(ourStoryDir)) mkdirSync(ourStoryDir, { recursive: true });

const files = readdirSync(galleryDir)
  .filter((f) => IMAGE_EXTS.test(f))
  .sort();

writeFileSync(join(galleryDir, 'manifest.json'), JSON.stringify(files, null, 2));
console.log(`gallery manifest: ${files.length} image(s) → ${galleryDir}/manifest.json`);

// Each entry carries its actual intrinsic pixel dimensions (not just the
// filename) so OurStoryComponent can set width/height attributes on the
// <img> - browsers use those to reserve the correct aspect-ratio box before
// the image has loaded, preventing the layout shift that comes from an
// unsized <img> collapsing to 0 height and then jumping once it loads
// (flagged by Lighthouse's "unsized-images" audit / poor CLS).
const ourStoryFiles = readdirSync(ourStoryDir)
  .filter((f) => STORY_IMAGE_EXTS.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  .map((file) => {
    try {
      const { width, height } = imageSize(readFileSync(join(ourStoryDir, file)));
      return { file, width, height };
    } catch {
      console.warn(`our story manifest: could not read dimensions for ${file}, skipping size info`);
      return { file, width: 0, height: 0 };
    }
  });

writeFileSync(join(ourStoryDir, 'manifest.json'), JSON.stringify(ourStoryFiles, null, 2));
console.log(`our story manifest: ${ourStoryFiles.length} image(s) → ${ourStoryDir}/manifest.json`);
