import { describe, expect, it } from "vitest";

import {
  LETTER_LIMIT,
  LETTER_RADIUS,
  createSoup,
  layoutSoupLetters,
  scatterSoup,
  spellSoup,
  stepSoup,
  stirSoup,
  swirlSoup,
  type Soup,
} from "@/lib/alphabet-soup";
import {
  SOUP_MESSAGES,
  SOUP_PRAISE,
  guestSoupMessage,
  placeSoupMessage,
  reletterSoup,
} from "@/lib/soup-messages";

const FRAME = 1 / 60;

// Stirs once round the bowl, clockwise as seen on screen, in one second.
function stirRound(soup: Soup, radius = 0.5) {
  for (let frame = 0; frame < 60; frame++) {
    const from = (frame / 60) * 2 * Math.PI;
    const to = ((frame + 1) / 60) * 2 * Math.PI;
    stirSoup(
      soup,
      radius * Math.cos(from),
      radius * Math.sin(from),
      radius * Math.cos(to),
      radius * Math.sin(to),
      FRAME,
    );
    stepSoup(soup, FRAME);
  }
}

// Steps until the soup reports it is still. Returns the seconds that took.
function settle(soup: Soup, limit = 60) {
  for (let frame = 0; frame < limit * 60; frame++) {
    if (!stepSoup(soup, FRAME)) {
      return frame * FRAME;
    }
  }
  throw new Error("The soup never settled.");
}

describe("layoutSoupLetters", () => {
  const letters = layoutSoupLetters();

  it("always serves the same soup", () => {
    expect(layoutSoupLetters()).toEqual(letters);
    expect(layoutSoupLetters(undefined, 5)).not.toEqual(letters);
  });

  it("has the whole alphabet, and the letters to spell SOUP PARTY as well", () => {
    const spare = letters.map((letter) => letter.char);
    for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "SOUPPARTY") {
      expect(spare).toContain(char);
      spare.splice(spare.indexOf(char), 1);
    }
  });

  it("keeps every letter in the bowl and off the others", () => {
    for (const [index, letter] of letters.entries()) {
      expect(Math.hypot(letter.x, letter.y)).toBeLessThanOrEqual(LETTER_LIMIT);
      for (const other of letters.slice(index + 1)) {
        expect(Math.hypot(letter.x - other.x, letter.y - other.y)).toBeGreaterThanOrEqual(
          2 * LETTER_RADIUS - 0.002,
        );
      }
    }
  });

  it("lays out whatever letters it is given", () => {
    expect(layoutSoupLetters("SOUP").map((letter) => letter.char).sort()).toEqual([
      "O",
      "P",
      "S",
      "U",
    ]);
  });
});

describe("stepSoup", () => {
  it("leaves an unstirred soup alone", () => {
    const letters = layoutSoupLetters();
    const soup = createSoup(letters);

    expect(stepSoup(soup, FRAME)).toBe(false);
    expect(Array.from(soup.x)).toEqual(letters.map((letter) => letter.x));
    expect(Array.from(soup.y)).toEqual(letters.map((letter) => letter.y));
    expect(Array.from(soup.angle)).toEqual(letters.map((letter) => letter.angle));
  });

  it("carries letters along a stroke", () => {
    const soup = createSoup([
      { char: "S", x: 0, y: 0, angle: 0 },
      { char: "O", x: 0, y: 0.8, angle: 0 },
    ]);

    // Left to right through the middle, over a quarter of a second.
    for (let frame = 0; frame < 15; frame++) {
      stirSoup(soup, -0.5 + frame / 15, 0, -0.5 + (frame + 1) / 15, 0, FRAME);
      expect(stepSoup(soup, FRAME)).toBe(true);
    }

    expect(soup.x[0]).toBeGreaterThan(0.1);
    expect(Math.abs(soup.y[0])).toBeLessThan(0.05);
    // Broth pushed across the bowl comes back round the sides.
    expect(soup.vx[1]).toBeLessThan(0);
    expect(Math.abs(soup.x[1])).toBeLessThan(soup.x[0]);
  });

  it("turns with a circular stir, and keeps turning for a while", () => {
    const soup = createSoup(layoutSoupLetters());
    stirRound(soup);
    for (let frame = 0; frame < 30; frame++) {
      stepSoup(soup, FRAME);
    }

    // Clockwise on screen, where y points down.
    let turning = 0;
    for (let n = 0; n < soup.letters; n++) {
      turning += soup.x[n] * soup.vy[n] - soup.y[n] * soup.vx[n];
    }
    expect(turning).toBeGreaterThan(0.5);
  });

  it("does not heap the letters against the bowl", () => {
    const soup = createSoup(layoutSoupLetters());
    const reach = () => {
      let total = 0;
      for (let n = 0; n < soup.letters; n++) {
        total += Math.hypot(soup.x[n], soup.y[n]);
      }
      return total / soup.letters;
    };
    const served = reach();

    for (let round = 0; round < 4; round++) {
      stirRound(soup, 0.6);
    }
    settle(soup);

    expect(reach()).toBeLessThan(served + 0.08);
  });

  it("keeps the letters in the bowl and apart however it is stirred", () => {
    const soup = createSoup(layoutSoupLetters());
    let seed = 1;
    const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    for (let frame = 0; frame < 900; frame++) {
      stirSoup(soup, next() * 2 - 1, next() * 2 - 1, next() * 2 - 1, next() * 2 - 1, FRAME);
      stepSoup(soup, FRAME);
      for (let n = 0; n < soup.letters; n++) {
        expect(Math.hypot(soup.x[n], soup.y[n])).toBeLessThanOrEqual(LETTER_LIMIT + 1e-9);
        expect(Number.isFinite(soup.angle[n])).toBe(true);
      }
    }

    settle(soup);
    for (let a = 0; a < soup.letters; a++) {
      for (let b = a + 1; b < soup.letters; b++) {
        expect(
          Math.hypot(soup.x[a] - soup.x[b], soup.y[a] - soup.y[b]),
        ).toBeGreaterThan(2 * LETTER_RADIUS - 0.01);
      }
    }
  });

  it("comes to rest once the stirring stops", () => {
    const soup = createSoup(layoutSoupLetters());
    stirRound(soup);

    const seconds = settle(soup);
    expect(seconds).toBeGreaterThan(2);
    expect(seconds).toBeLessThan(15);

    // What is left is too slow to see.
    const resting = Array.from(soup.x);
    for (let frame = 0; frame < 60; frame++) {
      expect(stepSoup(soup, FRAME)).toBe(false);
    }
    for (let n = 0; n < soup.letters; n++) {
      expect(Math.abs(soup.x[n] - resting[n])).toBeLessThan(0.005);
    }
  });

  it("moves the soup about as far at any frame rate", () => {
    const letters = layoutSoupLetters();
    const run = (rate: number) => {
      const soup = createSoup(letters);
      // One stroke across the bowl in half a second, then left to settle.
      for (let frame = 0; frame < rate / 2; frame++) {
        const from = -0.6 + (frame / rate) * 2.4;
        stirSoup(soup, from, 0.1, from + 2.4 / rate, 0.1, 1 / rate);
        stepSoup(soup, 1 / rate);
      }
      while (stepSoup(soup, 1 / rate));

      let moved = 0;
      for (const [n, letter] of letters.entries()) {
        moved += Math.hypot(soup.x[n] - letter.x, soup.y[n] - letter.y);
      }
      return moved / letters.length;
    };
    const usual = run(60);

    expect(usual).toBeGreaterThan(0.3);
    expect(run(30) / usual).toBeGreaterThan(0.85);
    expect(run(30) / usual).toBeLessThan(1.15);
    expect(run(120) / usual).toBeGreaterThan(0.85);
    expect(run(120) / usual).toBeLessThan(1.15);
  });

  it("ignores a step of no time", () => {
    const soup = createSoup(layoutSoupLetters());
    swirlSoup(soup, 30);
    const before = Array.from(soup.x);

    expect(stepSoup(soup, 0)).toBe(true);
    expect(stepSoup(soup, -1)).toBe(true);
    expect(Array.from(soup.x)).toEqual(before);
  });
});

describe("spellSoup", () => {
  const letters = layoutSoupLetters();
  const chars = letters.map((letter) => letter.char);

  // Stirs a soup and has it spell a message as it slows, as the bowl does.
  function spell(message = SOUP_MESSAGES[0], from = chars) {
    const soup = createSoup(letters);
    stirRound(soup);
    while (soup.speed > 0.2) {
      stepSoup(soup, FRAME);
    }
    const places = placeSoupMessage(message, from, soup.x, soup.y)!;
    spellSoup(soup, places);
    return { soup, places };
  }

  it("draws the letters to their places and holds them there", () => {
    const { soup, places } = spell();
    expect(soup.spelling).toBe(9);
    expect(soup.astray).toBe(9);

    expect(settle(soup)).toBeLessThan(10);
    expect(soup.astray).toBe(0);
    for (const place of places) {
      expect(soup.x[place.letter]).toBe(place.x);
      expect(soup.y[place.letter]).toBe(place.y);
      // Whichever way round it got there.
      expect((soup.angle[place.letter] - place.angle) % 360).toBeCloseTo(0, 6);
    }
  });

  it("forms the word in a few seconds, without hurrying", () => {
    const { soup, places } = spell();
    const { letter, x, y } = places[0];
    const start = Math.hypot(soup.x[letter] - x, soup.y[letter] - y);

    let seconds = 0;
    let fastest = 0;
    while (soup.astray > 0) {
      const from = [soup.x[letter], soup.y[letter]];
      stepSoup(soup, FRAME);
      seconds += FRAME;
      fastest = Math.max(
        fastest,
        Math.hypot(soup.x[letter] - from[0], soup.y[letter] - from[1]) / FRAME,
      );
      // It only ever gets nearer: no overshoot, and no bounce.
      expect(Math.hypot(soup.x[letter] - x, soup.y[letter] - y)).toBeLessThan(start + 0.05);
    }

    expect(seconds).toBeGreaterThan(1.5);
    expect(seconds).toBeLessThan(5);
    expect(fastest).toBeLessThan(1.5);
  });

  it("keeps the other letters clear of the word, and in the bowl", () => {
    for (const message of [...SOUP_MESSAGES, SOUP_PRAISE]) {
      const { soup } = spell(message);
      settle(soup);

      for (let a = 0; a < soup.letters; a++) {
        expect(Math.hypot(soup.x[a], soup.y[a])).toBeLessThanOrEqual(LETTER_LIMIT + 1e-9);
        for (let b = 0; b < soup.letters; b++) {
          if (soup.hold[a] > 0 && soup.hold[b] === 0) {
            expect(
              Math.hypot(soup.x[a] - soup.x[b], soup.y[a] - soup.y[b]),
            ).toBeGreaterThan(0.27);
          }
        }
      }
    }
  });

  it("comes to rest however long the names", () => {
    for (const names of [["Christine", "Alexander"], ["Mmmmmmmmm", "Wwwwwwwww"], ["Al"]]) {
      const guests = guestSoupMessage(names)!;
      const changes = reletterSoup(chars, guests)!;
      const { soup } = spell(guests, chars.map((char, index) => changes.get(index) ?? char));

      expect(settle(soup)).toBeLessThan(12);
      expect(soup.astray).toBe(0);
    }
  });

  it("holds the word against the broth until it is let go", () => {
    const { soup, places } = spell();
    settle(soup);

    stirRound(soup);
    for (const place of places) {
      expect(soup.x[place.letter]).toBe(place.x);
      expect(soup.y[place.letter]).toBe(place.y);
    }

    scatterSoup(soup);
    expect(soup.spelling).toBe(0);
    stirRound(soup);
    const moved = places.filter(
      (place) => Math.hypot(soup.x[place.letter] - place.x, soup.y[place.letter] - place.y) > 0.1,
    );
    expect(moved.length).toBeGreaterThan(6);
  });

  it("protects forming letters from stirring while loose letters still move", () => {
    const calm = createSoup(letters);
    const stirred = createSoup(letters);
    const places = placeSoupMessage(SOUP_MESSAGES[0], chars, calm.x, calm.y)!;
    spellSoup(calm, places);
    spellSoup(stirred, places);

    for (let frame = 0; frame < 240; frame++) {
      const from = frame / 60 * 2 * Math.PI;
      const to = (frame + 1) / 60 * 2 * Math.PI;
      stirSoup(stirred, 0.65 * Math.cos(from), 0.65 * Math.sin(from),
        0.65 * Math.cos(to), 0.65 * Math.sin(to), FRAME);
      stepSoup(calm, FRAME);
      stepSoup(stirred, FRAME);
      for (const { letter } of places) {
        expect(stirred.x[letter]).toBe(calm.x[letter]);
        expect(stirred.y[letter]).toBe(calm.y[letter]);
        expect(stirred.angle[letter]).toBe(calm.angle[letter]);
      }
    }

    expect(stirred.astray).toBe(0);
    const loose = letters.filter((_, n) => stirred.hold[n] === 0);
    expect(loose.length).toBeGreaterThan(0);
    expect(letters.some((letter, n) => stirred.hold[n] === 0 &&
      Math.hypot(stirred.x[n] - letter.x, stirred.y[n] - letter.y) > 0.2)).toBe(true);
  });

  it("forms the word about as fast at any frame rate", () => {
    const run = (rate: number) => {
      const soup = createSoup(letters);
      spellSoup(soup, placeSoupMessage(SOUP_MESSAGES[0], chars, soup.x, soup.y)!);
      let seconds = 0;
      do {
        stepSoup(soup, 1 / rate);
        seconds += 1 / rate;
      } while (soup.astray > 0);
      return seconds;
    };
    const usual = run(60);

    expect(run(30) / usual).toBeGreaterThan(0.9);
    expect(run(30) / usual).toBeLessThan(1.1);
    expect(run(120) / usual).toBeGreaterThan(0.9);
    expect(run(120) / usual).toBeLessThan(1.1);
  });
});

describe("swirlSoup", () => {
  it("turns the whole bowl gently, then lets it settle", () => {
    const letters = layoutSoupLetters();
    const soup = createSoup(letters);
    swirlSoup(soup, 30);

    const seconds = settle(soup);
    expect(seconds).toBeLessThan(12);

    let turned = 0;
    for (const [n, letter] of letters.entries()) {
      const before = Math.atan2(letter.y, letter.x);
      const after = Math.atan2(soup.y[n], soup.x[n]);
      turned += Math.atan2(Math.sin(after - before), Math.cos(after - before));
    }
    const degrees = (turned / letters.length) * (180 / Math.PI);
    expect(degrees).toBeGreaterThan(5);
    expect(degrees).toBeLessThan(60);
  });
});
