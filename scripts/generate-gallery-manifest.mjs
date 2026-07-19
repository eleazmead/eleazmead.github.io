import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const galleryDir = 'public/gallery';
const ourStoryDir = 'public/our-story';
const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif|avif)$/i;
const STORY_IMAGE_EXTS = /\.(jpg|jpeg|png)$/i;

if (!existsSync(galleryDir)) mkdirSync(galleryDir, { recursive: true });
if (!existsSync(ourStoryDir)) mkdirSync(ourStoryDir, { recursive: true });

const files = readdirSync(galleryDir)
  .filter((f) => IMAGE_EXTS.test(f))
  .sort();

writeFileSync(join(galleryDir, 'manifest.json'), JSON.stringify(files, null, 2));
console.log(`gallery manifest: ${files.length} image(s) → ${galleryDir}/manifest.json`);

const ourStoryFiles = readdirSync(ourStoryDir)
  .filter((f) => STORY_IMAGE_EXTS.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

writeFileSync(join(ourStoryDir, 'manifest.json'), JSON.stringify(ourStoryFiles, null, 2));
console.log(`our story manifest: ${ourStoryFiles.length} image(s) → ${ourStoryDir}/manifest.json`);
