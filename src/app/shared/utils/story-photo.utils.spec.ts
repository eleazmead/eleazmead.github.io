import { describe, expect, it } from 'vitest';
import { StoryManifestEntry, groupStoryPhotosByPrefix } from './story-photo.utils';

function entry(file: string, width = 800, height = 600): StoryManifestEntry {
  return { file, width, height };
}

describe('groupStoryPhotosByPrefix', () => {
  it('groups photo 1 and photo 2 under the same lowercased prefix', () => {
    const grouped = groupStoryPhotosByPrefix([entry('Sep_2016_1.jpg'), entry('Sep_2016_2.png')]);

    expect(grouped.get('sep_2016')).toEqual([
      'our-story/Sep_2016_1.jpg',
      'our-story/Sep_2016_2.png',
    ]);
  });

  it('keeps slot order even when photo 2 is listed before photo 1', () => {
    const grouped = groupStoryPhotosByPrefix([entry('Apr_2017_2.webp'), entry('Apr_2017_1.jpeg')]);

    expect(grouped.get('apr_2017')).toEqual([
      'our-story/Apr_2017_1.jpeg',
      'our-story/Apr_2017_2.webp',
    ]);
  });

  it('ignores files that do not match the Mmm_YYYY_N.ext pattern', () => {
    const grouped = groupStoryPhotosByPrefix([entry('manifest.json'), entry('Sep_2016_3.jpg')]);

    expect(grouped.size).toBe(0);
  });

  it('is case-insensitive on both the prefix and the extension', () => {
    const grouped = groupStoryPhotosByPrefix([entry('sep_2016_1.JPG')]);

    expect(grouped.get('sep_2016')).toEqual(['our-story/sep_2016_1.JPG']);
  });
});
