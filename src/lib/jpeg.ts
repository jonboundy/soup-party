// Reads a JPEG's structure without decoding it. Nothing here touches the DOM
// or the database.

export type Jpeg = { bytes: Uint8Array<ArrayBuffer>; width: number; height: number };

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;

// Start-of-frame markers: 0xC0 to 0xCF, apart from the three that are tables.
function isFrame(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function startsWith(bytes: Uint8Array, offset: number, text: string) {
  for (let index = 0; index < text.length; index++) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

// Application segments carry whatever a camera or an editor chose to write:
// where the photo was taken, by what, a thumbnail of the uncropped original.
// Only the three a decoder needs to show the right colours are kept.
function keeps(marker: number, bytes: Uint8Array, payload: number) {
  if (marker === 0xfe) return false; // A comment.
  if (marker < APP0 || marker > 0xef) return true;
  if (marker === APP0) return startsWith(bytes, payload, "JFIF\0");
  if (marker === APP2) return startsWith(bytes, payload, "ICC_PROFILE\0");
  if (marker === APP14) return startsWith(bytes, payload, "Adobe");
  return false;
}

/**
 * A JPEG with its metadata removed and its size in pixels, or null for
 * anything that is not a complete greyscale or colour JPEG of at most
 * `maxEdge` pixels a side.
 *
 * The image data is copied as it is, not decoded, so nothing is lost and
 * nothing a decoder might trip on is run here. Whatever follows the end of
 * the image, where phones append video and depth maps, is dropped.
 */
export function cleanJpeg(bytes: Uint8Array, maxEdge: number): Jpeg | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;

  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let size: { width: number; height: number } | null = null;
  let scanned = false;
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // Padding before a marker.
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker === EOI) break;
    // Every other marker allowed here is followed by its segment's length.
    if (marker === SOI || marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) return null;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    let end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return null;

    if (isFrame(marker)) {
      // Precision, height, width, number of components.
      if (size || length < 8) return null;
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      const components = bytes[offset + 9];
      if (width < 1 || height < 1 || width > maxEdge || height > maxEdge) return null;
      if (components !== 1 && components !== 3) return null;
      size = { width, height };
    }

    if (marker === SOS) {
      if (!size) return null;
      scanned = true;
      // The scan's data runs to the next marker that is neither a stuffed
      // 0xFF nor a restart.
      while (end < bytes.length) {
        if (bytes[end] !== 0xff) {
          end++;
          continue;
        }
        const next = bytes[end + 1];
        if (next === 0x00 || next === 0xff || (next >= 0xd0 && next <= 0xd7)) {
          end += next === 0xff ? 1 : 2;
          continue;
        }
        break;
      }
    }

    if (keeps(marker, bytes, offset + 4)) kept.push(bytes.subarray(offset, end));
    offset = end;
  }

  // Cut short, or never an image at all.
  if (!size || !scanned || bytes[offset] !== 0xff || bytes[offset + 1] !== EOI) return null;
  kept.push(bytes.subarray(offset, offset + 2));

  const clean = new Uint8Array(kept.reduce((total, part) => total + part.length, 0));
  let written = 0;
  for (const part of kept) {
    clean.set(part, written);
    written += part.length;
  }
  return { bytes: clean, ...size };
}
