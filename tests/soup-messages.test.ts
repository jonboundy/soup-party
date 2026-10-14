import { describe, expect, it } from "vitest";

import { LETTER_LIMIT, layoutSoupLetters } from "@/lib/alphabet-soup";
import {
  LINE_LENGTH,
  SOUP_MESSAGES,
  SOUP_PRAISE,
  guestSoupMessage,
  placeSoupMessage,
  reletterSoup,
  soupMessageQueue,
  soupStirTracker,
  type SoupMessage,
} from "@/lib/soup-messages";

const letters = layoutSoupLetters();
const chars = letters.map((letter) => letter.char);
const x = letters.map((letter) => letter.x);
const y = letters.map((letter) => letter.y);

describe("soupStirTracker", () => {
  it("counts three gestures with short pauses while the broth is still spinning", () => {
    const tracker = soupStirTracker();
    const starts: number[] = [];
    for (let gesture = 0; gesture < 3; gesture++) {
      for (let move = 0; move < 20; move++) {
        const time = gesture * 1500 + move * 40;
        if (tracker.move(time)) starts.push(time);
      }
    }
    expect(starts).toEqual([0, 1500, 3000]);
  });

  it("counts a continuous stir once, regardless of how long it lasts", () => {
    const tracker = soupStirTracker();
    const queue = soupMessageQueue();
    for (let move = 0; move < 100; move++) {
      if (tracker.move(move * 100)) queue.stir();
    }
    expect(queue.next()?.label).toBe("SOUP PARTY");
    queue.shown();
    expect(queue.next()).toBeNull();
  });

  it("waits for a pause after the latest movement before forming a message", () => {
    const tracker = soupStirTracker();
    tracker.move(0);
    tracker.move(300);
    expect(tracker.paused(500)).toBe(false);
    expect(tracker.paused(501)).toBe(true);
  });
});

// What the letters chosen for a message spell, line by line.
function spelled(message: SoupMessage, from: readonly string[]) {
  const places = placeSoupMessage(message, from, x, y);
  return places && places.map((place) => from[place.letter]).join("");
}

describe("SOUP_MESSAGES", () => {
  it("starts with SOUP PARTY", () => {
    expect(SOUP_MESSAGES[0].label).toBe("SOUP PARTY");
  });

  it("can all be spelled with the soup as served", () => {
    for (const message of [...SOUP_MESSAGES, SOUP_PRAISE]) {
      expect(spelled(message, chars)).toBe(message.lines.join(""));
      for (const line of message.lines) {
        expect(line).toMatch(/^[A-Z]+$/);
        expect(line.length).toBeLessThanOrEqual(LINE_LENGTH);
      }
    }
  });
});

describe("guestSoupMessage", () => {
  it("is the guests' first names, a line each", () => {
    expect(guestSoupMessage(["Jon Boundy", "Gigi"])).toEqual({
      lines: ["JON", "GIGI"],
      label: "JON and GIGI",
    });
    expect(guestSoupMessage(["  Mary Jane  Watson ", null])).toEqual({
      lines: ["MARY"],
      label: "MARY",
    });
  });

  it("drops accents", () => {
    expect(guestSoupMessage(["Zoë", "José"])?.lines).toEqual(["ZOE", "JOSE"]);
  });

  it("leaves out a name the soup cannot spell", () => {
    expect(guestSoupMessage(["Bartholomew", "Al"])?.lines).toEqual(["AL"]);
    expect(guestSoupMessage(["Anne-Marie", "D'Arcy"])).toBeNull();
    expect(guestSoupMessage(["Søren", null])).toBeNull();
    expect(guestSoupMessage(["李", "R2"])).toBeNull();
    expect(guestSoupMessage(["", null])).toBeNull();
  });
});

describe("reletterSoup", () => {
  it("changes nothing for a name the soup already has", () => {
    expect(reletterSoup(chars, guestSoupMessage(["Jon"])!)).toEqual(new Map());
  });

  it("finds the letters a name is short of", () => {
    const guests = guestSoupMessage(["Hannah", "Zoë"])!;
    const changes = reletterSoup(chars, guests)!;
    // BRING SPOON already needs two Ns; HANNAH still needs another H.
    expect([...changes.values()].sort()).toEqual(["H"]);

    const changed = chars.map((char, index) => changes.get(index) ?? char);
    expect(spelled(guests, changed)).toBe("HANNAHZOE");
  });

  it("takes them from letters no message needs", () => {
    for (const names of [["Zzzzzzzzz", "Qqqqqqqqq"], ["Mmmmmmmmm", "Wwwwwwwww"], ["Lulu", "Otto"]]) {
      const guests = guestSoupMessage(names)!;
      const changes = reletterSoup(chars, guests)!;
      const changed = chars.map((char, index) => changes.get(index) ?? char);

      for (const message of [...SOUP_MESSAGES, SOUP_PRAISE, guests]) {
        expect(spelled(message, changed)).toBe(message.lines.join(""));
      }
    }
  });

  it("gives up when there are not enough to spare", () => {
    expect(reletterSoup(["S", "O", "U", "P", "X"], guestSoupMessage(["Barbara"])!, [])).toBeNull();
    expect(
      reletterSoup(["S", "O", "U", "P", "X"], guestSoupMessage(["Al"])!, [
        { lines: ["SOUP"], label: "SOUP" },
      ]),
    ).toBeNull();
    expect(reletterSoup(["S", "O", "U", "P", "X"], guestSoupMessage(["Bo"])!, [])).toEqual(
      new Map([[0, "B"]]),
    );
  });
});

describe("placeSoupMessage", () => {
  it("puts a word to a line across the middle of the bowl", () => {
    const places = placeSoupMessage(SOUP_MESSAGES[0], chars, x, y)!;
    expect(places).toHaveLength(9);

    const [s, o, u, p, p2] = places;
    expect(s.x).toBeLessThan(o.x);
    expect(o.x).toBeLessThan(u.x);
    expect(u.x).toBeLessThan(p.x);
    // PARTY is under SOUP, and both are centred.
    expect(p2.y).toBeGreaterThan(s.y + 0.2);
    expect(Math.abs(s.x + p.x)).toBeLessThan(0.03);
    expect(Math.abs(s.y + p2.y)).toBeLessThan(0.03);
  });

  it("leaves the letters nearly upright, the same way each time", () => {
    const places = placeSoupMessage(SOUP_MESSAGES[0], chars, x, y)!;
    for (const place of places) {
      expect(Math.abs(place.angle)).toBeLessThanOrEqual(4);
    }
    expect(places.some((place) => Math.abs(place.angle) > 1)).toBe(true);
    expect(placeSoupMessage(SOUP_MESSAGES[0], chars, x, y)).toEqual(places);
  });

  it("uses each letter once, and the nearest that fits", () => {
    const places = placeSoupMessage({ lines: ["P"], label: "P" }, chars, x, y)!;
    const nearest = Math.min(
      ...letters.filter((letter) => letter.char === "P").map((letter) => Math.hypot(letter.x, letter.y)),
    );
    expect(Math.hypot(x[places[0].letter], y[places[0].letter])).toBeCloseTo(nearest, 1);

    for (const message of SOUP_MESSAGES) {
      const used = placeSoupMessage(message, chars, x, y)!.map((place) => place.letter);
      expect(new Set(used).size).toBe(used.length);
    }
  });

  it("keeps the longest lines inside the bowl", () => {
    const guests = guestSoupMessage(["Christine", "Alexander"])!;
    const changes = reletterSoup(chars, guests)!;
    const changed = chars.map((char, index) => changes.get(index) ?? char);
    for (const place of placeSoupMessage(guests, changed, x, y)!) {
      expect(Math.hypot(place.x, place.y)).toBeLessThan(LETTER_LIMIT - 0.1);
    }
  });

  it("does not spell what the soup has no letters for", () => {
    expect(placeSoupMessage({ lines: ["STILL", "LLAMA"], label: "" }, chars, x, y)).toBeNull();
  });
});

describe("soupMessageQueue", () => {
  // Stirs the soup, letting each message form. Returns what each stir ended in.
  function stir(queue: ReturnType<typeof soupMessageQueue>, times: number) {
    const ended: (string | null)[] = [];
    for (let n = 0; n < times; n++) {
      queue.stir();
      const message = queue.next();
      if (message) {
        queue.shown();
      }
      ended.push(message?.label ?? null);
    }
    return ended;
  }

  it("ends each stir in a message, in order and round again", () => {
    expect(stir(soupMessageQueue(), 8)).toEqual([
      "SOUP PARTY",
      "GOOD SOUP",
      "GOOD STIR",
      "BRING SPOON",
      "MORE SOUP",
      "STILL SOUP",
      "BRING SOUP",
      "SOUP PARTY",
    ]);
  });

  it("has nothing for a soup that has not been stirred", () => {
    expect(soupMessageQueue().next()).toBeNull();
  });

  it("keeps a message that a stir interrupted", () => {
    const queue = soupMessageQueue();
    queue.stir();
    expect(queue.next()?.label).toBe("SOUP PARTY");
    // Stirred again before it had formed.
    queue.stir();
    expect(queue.next()?.label).toBe("SOUP PARTY");
    queue.shown();
    expect(stir(queue, 1)).toEqual(["GOOD SOUP"]);
  });

  it("puts a guest next, then gives them a turn like the rest", () => {
    const queue = soupMessageQueue();
    queue.greet(guestSoupMessage(["Jon", "Gigi"])!);

    expect(stir(queue, 10)).toEqual([
      "JON and GIGI",
      "SOUP PARTY",
      "GOOD SOUP",
      "GOOD STIR",
      "BRING SPOON",
      "MORE SOUP",
      "STILL SOUP",
      "BRING SOUP",
      "JON and GIGI",
      "SOUP PARTY",
    ]);
  });

  it("does not spell a guest twice running", () => {
    const queue = soupMessageQueue();
    stir(queue, 7);
    // Every message has had its turn, so a guest's would be next anyway.
    queue.greet(guestSoupMessage(["Jon"])!);
    expect(stir(queue, 2)).toEqual(["JON", "SOUP PARTY"]);
  });

  it("spells GOOD JOB once after fifteen stirs, then resumes the rotation", () => {
    const queue = soupMessageQueue();
    expect(stir(queue, 14)).toEqual([...SOUP_MESSAGES, ...SOUP_MESSAGES].map(message => message.label));
    expect(stir(queue, 1)).toEqual(["GOOD JOB"]);
    const later = stir(queue, 80).filter(Boolean);
    expect(later[0]).toBe("SOUP PARTY");
    expect(later).not.toContain("GOOD JOB");
  });

  it("keeps praise next when a stir interrupts it before it forms", () => {
    const queue = soupMessageQueue();
    stir(queue, 14);
    queue.stir();
    expect(queue.next()).toBe(SOUP_PRAISE);
    queue.stir();
    expect(queue.next()).toBe(SOUP_PRAISE);
    queue.shown();
    expect(stir(queue, 1)).toEqual(["SOUP PARTY"]);
  });

  it("greets a guest before earned praise, without using up either", () => {
    const queue = soupMessageQueue();
    stir(queue, 14);
    queue.greet(guestSoupMessage(["Hannah"])!);
    expect(stir(queue, 2)).toEqual(["HANNAH", "GOOD JOB"]);
    expect(stir(queue, 1)).toEqual(["SOUP PARTY"]);
  });

  it("keeps a guest next when they RSVP while praise is forming", () => {
    const queue = soupMessageQueue();
    stir(queue, 14);
    queue.stir();
    expect(queue.next()).toBe(SOUP_PRAISE);
    queue.greet(guestSoupMessage(["Hannah"])!);
    queue.shown();
    expect(stir(queue, 1)).toEqual(["HANNAH"]);
    expect(stir(queue, 1)).toEqual(["SOUP PARTY"]);
  });
});
