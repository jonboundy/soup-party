// Builds files with a JPEG's structure. Nothing decodes them, so the image
// data is filler: the code under test reads structure, not pixels.

const text = (value: string) => [...value].map((character) => character.charCodeAt(0));

function segment(marker: number, payload: number[]) {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

/** What a camera adds: where and by whom, an editor's record, a comment. */
export const metadata = [
  ...segment(0xe1, text("Exif\0\0GPS 51.5007N 0.1246W, Ada's phone")),
  ...segment(0xe1, text("http://ns.adobe.com/xap/1.0/\0<creator>Ada Lovelace</creator>")),
  ...segment(0xed, text("Photoshop 3.0\0caption: the kitchen")),
  ...segment(0xfe, text("taken at home")),
];

/** What a decoder needs to show the right colours, which is kept. */
export const colour = [
  ...segment(0xe2, text("ICC_PROFILE\0\x01\x01profile")),
  ...segment(0xee, text("Adobe\0d\0\0\0\0\x01")),
];

export function testJpeg({
  width = 400,
  height = 300,
  components = 3,
  /** Segments between the JFIF header and the tables. */
  extra = [] as number[],
  /** Bytes of image data, for a file of a given size. */
  scan = 16,
  /** Bytes after the end of the image. */
  trailing = [] as number[],
} = {}) {
  return Uint8Array.from([
    0xff, 0xd8,
    ...segment(0xe0, [...text("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...extra,
    ...segment(0xdb, Array.from({ length: 65 }, (_, index) => index)),
    ...segment(0xc0, [
      8, height >> 8, height & 0xff, width >> 8, width & 0xff, components,
      ...Array.from({ length: components }, (_, index) => [index + 1, 0x11, 0]).flat(),
    ]),
    ...segment(0xc4, [0, ...Array.from({ length: 16 }, () => 0)]),
    ...segment(0xda, [components, ...Array.from({ length: components }, (_, index) => [index + 1, 0]).flat(), 0, 63, 0]),
    // Image data, with a stuffed 0xFF and a restart marker inside it.
    0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, ...Array.from({ length: scan }, () => 0x55),
    0xff, 0xd9,
    ...trailing,
  ]);
}

/** A form carrying one file as an upload does. */
export function photoForm(fields: Record<string, string>, photo?: Uint8Array<ArrayBuffer> | null, type = "image/jpeg") {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  if (photo) data.set("photo", new Blob([photo], { type }), "photo.jpg");
  return data;
}

export { text };
