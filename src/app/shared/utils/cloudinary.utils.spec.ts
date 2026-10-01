import { cloudinaryResized } from './cloudinary.utils';

describe('cloudinaryResized', () => {
  it('inserts the transformation after /image/upload/', () => {
    expect(
      cloudinaryResized('https://res.cloudinary.com/demo/image/upload/v1/a.jpg', 'w_900,q_auto'),
    ).toBe('https://res.cloudinary.com/demo/image/upload/w_900,q_auto/v1/a.jpg');
  });

  it('leaves other hosts untouched', () => {
    const url = 'https://example.com/image/upload/a.jpg';
    expect(cloudinaryResized(url, 'w_900')).toBe(url);
  });
});
