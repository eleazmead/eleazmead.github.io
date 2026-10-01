const UPLOAD_MARKER = '/image/upload/';

// Asks Cloudinary for a resized copy (delivery transformation); other hosts are returned unchanged.
export function cloudinaryResized(url: string, transformation: string): string {
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(url) || !url.includes(UPLOAD_MARKER)) return url;
  return url.replace(UPLOAD_MARKER, `${UPLOAD_MARKER}${transformation}/`);
}
