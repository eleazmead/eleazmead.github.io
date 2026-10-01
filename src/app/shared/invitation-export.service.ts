import { Injectable } from '@angular/core';

// html2canvas/jspdf/jszip are dynamically imported so their ~500kB stays out of the initial bundle.

// Pages are opaque photo/paper content: JPEG is a few hundred kB per page, PNG was several MB.
const IMAGE_MIME = 'image/jpeg';
const IMAGE_QUALITY = 0.85;
const IMAGE_EXT = 'jpg';
// 1.5x keeps text/QR codes sharp at ~56% of the pixels (and time/memory) of 2x.
const CAPTURE_SCALE = 1.5;
// iOS Safari caps total canvas memory; 1x (1080x1620) stays readable on a phone.
const IOS_CAPTURE_SCALE = 1;

type ShareableNavigator = Navigator & {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[]; title?: string }) => Promise<void>;
};

@Injectable({ providedIn: 'root' })
export class InvitationExportService {
  // Encode each page to a JPEG blob and free its canvas right away: nine ~16MB canvases at once
  // exceed iOS Safari's memory budget and the tab reloads.
  async captureAsBlobs(elements: HTMLElement[]): Promise<Blob[]> {
    const html2canvas = (await import('html2canvas')).default;
    const blobs: Blob[] = [];
    const scale = this.isIos() ? IOS_CAPTURE_SCALE : CAPTURE_SCALE;

    for (const element of elements) {
      const canvas = await html2canvas(element, {
        scale,
        backgroundColor: '#fbf7f2',
        useCORS: true,
      });
      blobs.push(await this.canvasToBlob(canvas));
      // Shrinking to 0x0 frees the backing store immediately on WebKit.
      canvas.width = 0;
      canvas.height = 0;
    }

    return blobs;
  }

  // Uses the native share sheet where available (phones), else a zip download.
  // Returns 'needs-tap' when share() was refused because the tap is too old (iOS allows it only briefly,
  // and rendering can outlast that); the caller then shows a button that calls shareImages().
  async exportAsImages(blobs: Blob[], fileBaseName: string): Promise<'done' | 'needs-tap'> {
    const files = this.toFiles(blobs, fileBaseName);
    const nav = navigator as ShareableNavigator;
    if (nav.share && nav.canShare?.({ files })) {
      try {
        await nav.share({ files, title: fileBaseName });
        return 'done';
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'done';
        if (err instanceof DOMException && err.name === 'NotAllowedError') return 'needs-tap';
        console.warn('Web Share failed, falling back to zip download:', err);
      }
    }
    await this.downloadZip(blobs, fileBaseName);
    return 'done';
  }

  // Call straight from a click handler with no awaits before it.
  async shareImages(blobs: Blob[], fileBaseName: string): Promise<void> {
    const files = this.toFiles(blobs, fileBaseName);
    try {
      await (navigator as ShareableNavigator).share!({ files, title: fileBaseName });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('Web Share failed, falling back to zip download:', err);
      await this.downloadZip(blobs, fileBaseName);
    }
  }

  private toFiles(blobs: Blob[], fileBaseName: string): File[] {
    return blobs.map(
      (blob, index) =>
        new File([blob], `${fileBaseName}_${index + 1}.${IMAGE_EXT}`, { type: IMAGE_MIME }),
    );
  }

  private async downloadZip(blobs: Blob[], fileBaseName: string): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    blobs.forEach((blob, index) => zip.file(`${fileBaseName}_${index + 1}.${IMAGE_EXT}`, blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(zipBlob, `${fileBaseName}.zip`);
  }

  async exportAsPdf(
    blobs: Blob[],
    fileBaseName: string,
    pageWidthPx: number,
    pageHeightPx: number,
  ): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'px', format: [pageWidthPx, pageHeightPx] });

    for (let index = 0; index < blobs.length; index++) {
      if (index > 0) doc.addPage([pageWidthPx, pageHeightPx]);
      const bytes = new Uint8Array(await blobs[index].arrayBuffer());
      doc.addImage(bytes, 'JPEG', 0, 0, pageWidthPx, pageHeightPx);
    }

    doc.save(`${fileBaseName}.pdf`);
  }

  private isIos(): boolean {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  }

  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas.toBlob returned null'));
        },
        IMAGE_MIME,
        IMAGE_QUALITY,
      );
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
