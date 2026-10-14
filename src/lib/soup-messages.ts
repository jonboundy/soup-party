// What the alphabet soup in the hero spells now and then, and when. Plain
// arithmetic with no DOM, like the soup itself.

import { random, type SoupLetter, type SoupPlace } from "@/lib/alphabet-soup";

export type SoupMessage = {
  /** Capital letters A to Z only, a word to a line. */
  lines: string[];
  /** How the message is read out. */
  label: string;
};

/** The most letters a line holds. */
export const LINE_LENGTH = 9;

// From the middle of one letter to the next, and of one line to the next.
// Closer than loose letters keep to each other, so that a word reads as one.
const PITCH = 0.18;
const LINE_GAP = 0.27;
// How far a letter of a word is left off true: degrees, and a part of a radius.
const TILT = 4;
const SLIP = 0.012;

/** The first stir that ends in a message, and how many stirs later the next does. */
const FIRST_STIR = 1;
const STIRS_BETWEEN = 1;

// A pause in the person's movement separates stirs even while the broth is
// still spinning. Waiting for the broth to slow would swallow short pauses.
const STIR_PAUSE = 200;

export function soupStirTracker() {
  let moved = -Infinity;
  return {
    /** Records movement; true when it starts a new stir. */
    move(now: number) {
      const fresh = now - moved > STIR_PAUSE;
      moved = now;
      return fresh;
    },
    /** The person has stopped moving long enough for a message to form. */
    paused(now: number) {
      return now - moved > STIR_PAUSE;
    },
  };
}

function phrase(...lines: string[]): SoupMessage {
  return { lines, label: lines.join(" ") };
}

/** In the order they appear. The bowl is served with the letters for all of them. */
export const SOUP_MESSAGES: readonly SoupMessage[] = [
  phrase("SOUP", "PARTY"),
  phrase("GOOD", "SOUP"),
  phrase("I", "AM", "SOUP"),
  phrase("GOOD", "STIR"),
  phrase("BIRD", "NIGHT"),
  phrase("BRING", "GAMES"),
  phrase("I", "SEE", "YOU"),
  phrase("MORE", "SOUP"),
  phrase("STILL", "SOUP"),
  phrase("ARE", "YOU", "DONE"),
  phrase("BRING", "SOUP"),
  phrase("PLEASE", "STOP"),
];

/** What the soup spells as it is served, before anyone stirs it. Not one of the rotation. */
export const SOUP_INVITATION = phrase("STIR", "ME");

/**
 * The first names of the guests behind a response, a line each, like a place
 * card. An accent is dropped. A name the soup cannot spell, being longer than
 * a line or having anything but A to Z in it, is left out, and with no name
 * left there is no message.
 */
export function guestSoupMessage(names: readonly (string | null)[]): SoupMessage | null {
  const lines: string[] = [];
  for (const name of names) {
    const first = (name ?? "")
      .trim()
      .split(/\s+/u)[0]
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toUpperCase();
    if (/^[A-Z]+$/.test(first) && first.length <= LINE_LENGTH) {
      lines.push(first);
    }
  }
  return lines.length ? { lines, label: lines.join(" and ") } : null;
}

function count(text: Iterable<string>) {
  const counts = new Map<string, number>();
  for (const char of text) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  return counts;
}

/**
 * The letters to change so that the soup can spell a message it was not
 * served with, as the index of each and what it becomes. Only letters that no
 * message needs are changed, and none that `avoid` picks out, such as those
 * in a word at the time. Null if there are not enough of those.
 */
export function reletterSoup(
  chars: readonly string[],
  message: SoupMessage,
  keep: readonly SoupMessage[] = SOUP_MESSAGES,
  avoid: (letter: number) => boolean = () => false,
): Map<number, string> | null {
  const wanted = count(message.lines.join(""));
  const needed = new Map(wanted);
  for (const other of keep) {
    for (const [char, times] of count(other.lines.join(""))) {
      needed.set(char, Math.max(needed.get(char) ?? 0, times));
    }
  }

  // What the bowl has more of than any message needs, the most plentiful
  // first, so that the alphabet stays as whole as it can.
  const spare = count(chars);
  for (const char of new Set([...spare.keys(), ...needed.keys()])) {
    spare.set(char, (spare.get(char) ?? 0) - (needed.get(char) ?? 0));
  }
  const donors = chars
    .map((_, index) => index)
    .filter((index) => !avoid(index))
    .sort((a, b) => spare.get(chars[b])! - spare.get(chars[a])! || a - b);

  const changes = new Map<number, string>();
  for (const char of wanted.keys()) {
    for (let short = -spare.get(char)!; short > 0; short--) {
      const donor = donors.find(
        (index) => !changes.has(index) && spare.get(chars[index])! > 0,
      );
      if (donor === undefined) {
        return null;
      }
      spare.set(chars[donor], spare.get(chars[donor])! - 1);
      changes.set(donor, char);
    }
  }
  return changes;
}

/**
 * Where the letters of a message go: on lines across the middle of the bowl,
 * nearly upright. Seeded by the message, so it is askew the same way each
 * time.
 */
export function soupMessageSpots(message: SoupMessage): SoupLetter[] {
  let seed = 0;
  for (const char of message.lines.join("\n")) {
    seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
  }
  const next = random(seed);

  const spots: SoupLetter[] = [];
  for (const [row, line] of message.lines.entries()) {
    for (let column = 0; column < line.length; column++) {
      spots.push({
        char: line[column],
        x: (column - (line.length - 1) / 2) * PITCH + (next() * 2 - 1) * SLIP,
        y: (row - (message.lines.length - 1) / 2) * LINE_GAP + (next() * 2 - 1) * SLIP,
        angle: (next() * 2 - 1) * TILT,
      });
    }
  }
  return spots;
}

/**
 * Where each letter of a message goes, as `soupMessageSpots`, each place
 * taken by the nearest letter that fits it. `x` and `y` are where the letters
 * are now. Null if the soup lacks a letter.
 */
export function placeSoupMessage(
  message: SoupMessage,
  chars: readonly string[],
  x: ArrayLike<number>,
  y: ArrayLike<number>,
): SoupPlace[] | null {
  const taken = new Set<number>();
  const places: SoupPlace[] = [];
  for (const { char, ...spot } of soupMessageSpots(message)) {
    const place = { letter: -1, ...spot };
    let nearest = Infinity;
    for (let n = 0; n < chars.length; n++) {
      const distance = (x[n] - place.x) ** 2 + (y[n] - place.y) ** 2;
      if (chars[n] === char && !taken.has(n) && distance < nearest) {
        place.letter = n;
        nearest = distance;
      }
    }
    if (place.letter < 0) {
      return null;
    }
    taken.add(place.letter);
    places.push(place);
  }
  return places;
}

/**
 * Decides which stirs end in a message, and in which one. It is a fixed
 * pattern and not chance: each completed stir, through the messages in
 * order and round again. A guest who has just responded is next whatever the
 * count, and from then on has a turn like the rest.
 */
export function soupMessageQueue(messages: readonly SoupMessage[] = SOUP_MESSAGES) {
  let stirs = 0;
  let due = FIRST_STIR;
  let turn = 0;
  let guest: SoupMessage | null = null;
  let greeting = false;
  // Whether `next` last gave the guest as a greeting.
  let greeted = false;
  const rotation = () => (guest ? [...messages, guest] : messages);

  return {
    /** A stir has begun. */
    stir() {
      stirs++;
    },
    /** The message to spell as the stir ends, or null if this is not the stir for one. */
    next(): SoupMessage | null {
      greeted = greeting;
      if (greeting) {
        return guest;
      }
      return stirs < due ? null : rotation()[turn % rotation().length];
    },
    /**
     * The message `next` gave was spelled. Until then it stays next, so a
     * stir that interrupts it does not lose it. A guest who responds while
     * another message is forming is still next after it.
     */
    shown() {
      if (greeted) {
        greeting = false;
        // Not twice running, if the rotation had just come round to it.
        if (turn % rotation().length === messages.length) {
          turn++;
        }
      } else {
        turn++;
      }
      due = stirs + STIRS_BETWEEN;
    },
    /** A guest has responded. */
    greet(message: SoupMessage) {
      if (!guest) {
        // Adding a turn for a guest must not change which phrase is next.
        turn %= messages.length;
      }
      guest = message;
      greeting = true;
    },
  };
}
