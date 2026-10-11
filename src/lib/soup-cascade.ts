// The cascade behind the home page: small bowls of soup falling slowly past.
// This decides where each one falls, how fast, and which soup is in it. The
// falling itself is a CSS animation in globals.css.

import { random } from "@/lib/alphabet-soup";

export type CascadeBowl = {
  /** Which soup is in it, counting from 0. */
  soup: number;
  /** Where across the page it falls: 0 is the left edge, 1 the right. */
  x: number;
  /** How far down it already is when the page is first seen, from 0 to 1. */
  start: number;
  /** 0 is furthest away: the smallest, faintest and slowest. */
  depth: 0 | 1 | 2;
  /** Seconds to fall the height of the page. */
  seconds: number;
  /** How far sideways it has wandered by the bottom, in rem. */
  drift: number;
};

// Seconds to fall the height of the page at each depth, give or take a tenth.
const FALL_SECONDS = [76, 54, 38];
const MAX_DRIFT = 3;

// Each bowl is placed a fixed stride on from the last, wrapping round. The
// strides are irrational (the R2 sequence), so however many bowls are shown,
// they are spread evenly and never line up.
const STRIDE_X = 0.7548776662466927;
const STRIDE_START = 0.5698402909980532;

/**
 * Lays out the falling bowls, sharing `soups` kinds of soup among them. The
 * same arguments always give the same cascade, and the first few bowls of a
 * longer one are evenly spread on their own, which is what a narrow screen
 * shows.
 */
export function layoutSoupCascade(soups: number, count = 15, seed = 11): CascadeBowl[] {
  const next = random(seed);
  // Soups are dealt from a shuffled round of them all, so none is left out
  // and none turns up much more often than another.
  const round: number[] = [];

  return Array.from({ length: count }, (_, index) => {
    if (round.length === 0) {
      for (let soup = 0; soup < soups; soup++) {
        round.splice(Math.floor(next() * (round.length + 1)), 0, soup);
      }
    }
    const depth = (index % 3) as CascadeBowl["depth"];
    return {
      soup: round.pop()!,
      x: Math.round(((0.5 + (index + 1) * STRIDE_X) % 1) * 1000) / 1000,
      start: Math.round(((0.5 + (index + 1) * STRIDE_START) % 1) * 1000) / 1000,
      depth,
      seconds: Math.round(FALL_SECONDS[depth] * (0.9 + 0.2 * next())),
      drift: Math.round((next() * 2 - 1) * MAX_DRIFT * 10) / 10,
    };
  });
}
