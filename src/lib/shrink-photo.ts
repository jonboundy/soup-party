// Runs in the browser only: it draws to a canvas.

import { RECIPE_PHOTO_MAX_BYTES, RECIPE_PHOTO_MAX_EDGE } from "@/lib/recipe-photo";

function encode(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Redraws a chosen image as a JPEG small enough to send and to store: at most
 * RECIPE_PHOTO_MAX_EDGE pixels a side and RECIPE_PHOTO_MAX_BYTES in size. A
 * phone's photo is several megabytes; this is a few hundred kilobytes and
 * still legible as a page of a cookbook. Redrawing also leaves behind where
 * and when the photo was taken, though the server does not rely on that.
 *
 * Null when the browser cannot read the file as an image.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    // Decoded through an element, which turns a photo the way its camera
    // recorded it was held and reads whatever formats the browser does.
    await image.decode();
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longest) return null;

    let scale = Math.min(1, RECIPE_PHOTO_MAX_EDGE / longest);
    // Lower the quality first, then the size, until it fits.
    for (const quality of [0.82, 0.7, 0.6, 0.5, 0.5, 0.5, 0.5]) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return null;
      // JPEG has no transparency. Without this a cut-out would turn black.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await encode(canvas, quality);
      if (blob?.type !== "image/jpeg") return null;
      if (blob.size <= RECIPE_PHOTO_MAX_BYTES) return blob;
      if (quality === 0.5) scale *= 0.8;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
