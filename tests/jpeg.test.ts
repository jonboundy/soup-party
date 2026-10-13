import { describe, expect, it } from "vitest";

import { cleanJpeg } from "@/lib/jpeg";

import { colour, metadata, testJpeg, text } from "./jpeg-fixture";

const clean = (bytes: Uint8Array, maxEdge = 1600) => cleanJpeg(bytes, maxEdge);
const contains = (bytes: Uint8Array, value: string) => Buffer.from(bytes).includes(Buffer.from(value, "latin1"));

describe("cleanJpeg", () => {
  it("reads the size of a JPEG and returns it unchanged when it has nothing to remove", () => {
    const jpeg = testJpeg({ width: 1200, height: 1600 });
    expect(clean(jpeg)).toEqual({ bytes: jpeg, width: 1200, height: 1600 });
  });

  it("removes where, when and by whom a photo was taken, and keeps the image", () => {
    const result = clean(testJpeg({ extra: metadata }));
    expect(result?.bytes).toEqual(testJpeg());
    for (const secret of ["Exif", "GPS", "Ada", "Photoshop", "kitchen", "taken at home"]) {
      expect(contains(result!.bytes, secret)).toBe(false);
    }
  });

  it("keeps what a decoder needs to show the right colours", () => {
    const jpeg = testJpeg({ extra: [...metadata, ...colour] });
    expect(clean(jpeg)?.bytes).toEqual(testJpeg({ extra: colour }));
  });

  it("drops an application segment that only resembles one it keeps", () => {
    const jfxx = [0xff, 0xe0, 0, 12, ...text("JFXX\0thumb")];
    const notIcc = [0xff, 0xe2, 0, 7, ...text("MPF\0\0")];
    expect(clean(testJpeg({ extra: [...jfxx, ...notIcc] }))?.bytes).toEqual(testJpeg());
  });

  it("drops whatever follows the end of the image", () => {
    const jpeg = testJpeg({ trailing: text("MotionPhoto: a video of the kitchen") });
    expect(clean(jpeg)?.bytes).toEqual(testJpeg());
  });

  it("does not mistake image data for the end of the image", () => {
    const result = clean(testJpeg({ scan: 5000 }));
    expect(result?.bytes).toHaveLength(testJpeg({ scan: 5000 }).length);
    expect([...result!.bytes.slice(-2)]).toEqual([0xff, 0xd9]);
  });

  it("accepts a greyscale JPEG", () => {
    expect(clean(testJpeg({ components: 1 }))).toMatchObject({ width: 400, height: 300 });
  });

  it("rejects a JPEG larger than the limit on either side, or with no size", () => {
    expect(clean(testJpeg({ width: 1600, height: 1600 }))).not.toBeNull();
    for (const size of [
      { width: 1601, height: 10 }, { width: 10, height: 1601 }, { width: 65535, height: 65535 },
      { width: 0, height: 10 }, { width: 10, height: 0 },
    ]) {
      expect(clean(testJpeg(size))).toBeNull();
    }
  });

  it("rejects a JPEG that is not greyscale or colour", () => {
    expect(clean(testJpeg({ components: 4 }))).toBeNull();
  });

  it("rejects a JPEG that has been cut short", () => {
    const jpeg = testJpeg();
    for (let length = 0; length < jpeg.length; length++) {
      expect(clean(jpeg.subarray(0, length))).toBeNull();
    }
  });

  it("rejects anything that is not a JPEG", () => {
    const png = Uint8Array.from([0x89, ...text("PNG\r\n\x1a\n"), 0, 0, 0, 13, ...text("IHDR")]);
    const svg = Uint8Array.from(text("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"));
    const html = Uint8Array.from([0xff, 0xd8, ...text("<html><script>alert(1)</script>")]);
    for (const file of [png, svg, html, new Uint8Array(), Uint8Array.of(0xff, 0xd8), Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)]) {
      expect(clean(file)).toBeNull();
    }
  });

  it("rejects a JPEG with a segment that runs past its end, or two frames", () => {
    const jpeg = testJpeg();
    const overrun = Uint8Array.from(jpeg);
    overrun[4] = 0xff; // The first segment's length.
    expect(clean(overrun)).toBeNull();
    const frame = [0xff, 0xc0, 0, 11, 8, 0, 10, 0, 10, 1, 1, 0x11, 0];
    expect(clean(testJpeg({ extra: frame }))).toBeNull();
  });
});
