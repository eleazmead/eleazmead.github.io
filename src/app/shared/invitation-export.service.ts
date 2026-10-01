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
// Per-page limit for rendering/encoding; beyond this something is blocked, not slow.
const PAGE_TIMEOUT_MS = 60_000;
// Rendering is retried once; 70s per attempt because iPads can take 30s+ on photo-heavy pages.
const RENDER_TIMEOUT_MS = 70_000;
const RENDER_ATTEMPTS = 2;

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
      const canvas = await this.renderPage(html2canvas, element, scale, blobs.length + 1);
      blobs.push(await this.canvasToBlob(canvas));
      // Shrinking to 0x0 frees the backing store immediately on WebKit.
      canvas.width = 0;
      canvas.height = 0;
    }

    return blobs;
  }

  // True for nodes that are neither the page, its ancestors, its descendants nor <head> content (styles must stay).
  private isOutsideBranch(node: Element, page: HTMLElement): boolean {
    if (node === page || page.contains(node) || node.contains(page)) return false;
    return !node.closest('head');
  }

  // html2canvas occasionally stalls on mobile (seen in Brave iOS); a stalled page is retried rather than failing the export.
  private async renderPage(
    html2canvas: (el: HTMLElement, opts: object) => Promise<HTMLCanvasElement>,
    element: HTMLElement,
    scale: number,
    pageNumber: number,
  ): Promise<HTMLCanvasElement> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RENDER_ATTEMPTS; attempt++) {
      try {
        return await this.withTimeout(
          html2canvas(element, {
            // The retry renders smaller: if the first attempt stalled the device is short on memory.
            scale: attempt === 1 ? scale : scale * 0.75,
            backgroundColor: '#fbf7f2',
            useCORS: true,
            // html2canvas clones the whole document per page; leaving out everything except this page's
            // branch (hero video, polaroids, the other 8 pages...) is the biggest speed and memory win.
            ignoreElements: (node: Element) => this.isOutsideBranch(node, element),
          }),
          RENDER_TIMEOUT_MS,
          `Rendering page ${pageNumber}`,
        );
      } catch (err) {
        lastError = err;
        console.warn(`Page ${pageNumber} render attempt ${attempt} failed:`, err);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    throw lastError;
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

  // Turns a silent hang (e.g. a privacy mode blocking canvas reads) into a visible error.
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return this.withTimeout(this.canvasToBlobRaw(canvas), PAGE_TIMEOUT_MS, 'Encoding page');
  }

  private canvasToBlobRaw(canvas: HTMLCanvasElement): Promise<Blob> {
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
    // Attached to the DOM and revoked late: iOS Chrome/Brave start the download asynchronously.
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  }
}
