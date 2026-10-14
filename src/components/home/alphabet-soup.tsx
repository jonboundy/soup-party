"use client"

import * as React from "react"
import { cn } from "cn"

import {
  createSoup,
  layoutSoupLetters,
  scatterSoup,
  spellSoup,
  stepSoup,
  stirSoup,
  swirlSoup,
} from "@/lib/alphabet-soup"
import { onSoupGuests } from "@/lib/soup-guests"
import {
  guestSoupMessage,
  placeSoupMessage,
  reletterSoup,
  SOUP_INVITATION,
  soupMessageQueue,
  soupMessageSpots,
  soupStirTracker,
  type SoupMessage,
} from "@/lib/soup-messages"

// The drawing's units. The broth that moves stops half a letter short of the
// broth that is drawn, so a letter carried to its edge stays clear of the bowl.
const VIEW = 440
const BROTH = 152
const UNIT = 138
// How fast the soup is turning when it is first seen, in degrees a second.
const SERVED_SWIRL = 26
// Once formed, a word stays protected for this long before stirring can
// release its letters. The rest of the soup remains free to move.
const WORD_HOLD = 3000

const LABEL = "A bowl of alphabet soup."

const spells = (message: SoupMessage) => `${LABEL} Some letters spell ${message.label}.`

// Served spelling an invitation.
const letters = layoutSoupLetters(undefined, undefined, soupMessageSpots(SOUP_INVITATION))

function place(x: number, y: number, angle: number) {
  return `translate(${(x * UNIT).toFixed(2)} ${(y * UNIT).toFixed(2)}) rotate(${angle.toFixed(1)})`
}

// A bowl of alphabet soup, seen from above, that can be stirred with a cursor
// or a finger. The server renders it complete and still, with some of the
// letters spelling STIR ME, which is how it stays without JavaScript and with
// reduced motion. Otherwise it turns a little when first seen, and runs only
// while it is on screen and has not yet settled.
//
// The first stir breaks up STIR ME. Now and then a stir ends with some of the
// letters in a message: see `soupMessageQueue` for which stirs and which
// messages. The next stir breaks it up.
function AlphabetSoup({ className, ...props }: React.ComponentProps<"div">) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pastaRef = React.useRef<SVGGElement>(null)
  const shadowsRef = React.useRef<SVGGElement>(null)

  React.useEffect(() => {
    const root = rootRef.current
    const pasta = pastaRef.current
    const shadows = shadowsRef.current
    if (!root || !pasta || !shadows) {
      return
    }

    const stillness = window.matchMedia("(prefers-reduced-motion: reduce)")
    const soup = createSoup(letters)
    swirlSoup(soup, SERVED_SWIRL)

    const pointers = new Map<number, { x: number; y: number }>()
    const strokes: number[] = []
    let onScreen = false
    let settled = false
    let frame = 0
    let last = 0

    const queue = soupMessageQueue()
    const stirs = soupStirTracker()
    // What each letter is. A guest's name can change some of them.
    const chars = letters.map((letter) => letter.char)
    let changes: Map<number, string> | null = null
    let stirring = false
    // The message forming or formed, and whether it has finished forming.
    // The invitation is formed already, and the first stir may break it up.
    let message: SoupMessage | null = SOUP_INVITATION
    let spelled = true
    let protectedUntil = 0
    spellSoup(soup, placeSoupMessage(SOUP_INVITATION, chars, soup.x, soup.y)!, true)

    // Letters change while nobody can see which: out of view, or failing
    // that as a stir sets them all moving.
    const reletter = () => {
      for (const [n, char] of changes ?? []) {
        chars[n] = char
        pasta.children[n].firstElementChild!.textContent = char
        shadows.children[n].firstElementChild!.textContent = char
      }
      changes = null
    }

    const tick = (now: number) => {
      // The first frame after a pause has no previous one to measure from.
      const seconds = last ? Math.min(Math.max((now - last) / 1000, 0), 0.1) : 1 / 60
      last = now
      for (let n = 0; n < strokes.length; n += 4) {
        stirSoup(
          soup,
          strokes[n],
          strokes[n + 1],
          strokes[n + 2],
          strokes[n + 3],
          seconds
        )
      }
      strokes.length = 0
      settled = !stepSoup(soup, seconds)

      if (stirring && stirs.paused(now)) {
        stirring = false
        if (!message) {
          message = queue.next()
          const places = message && placeSoupMessage(message, chars, soup.x, soup.y)
          if (places) {
            spellSoup(soup, places)
          } else {
            message = null
          }
        }
      }
      if (message && !spelled && soup.astray === 0) {
        spelled = true
        protectedUntil = now + WORD_HOLD
        queue.shown()
        // Named, for anyone who cannot see it, but not announced.
        root.setAttribute("aria-label", spells(message))
      }

      for (let n = 0; n < soup.letters; n++) {
        const transform = place(soup.x[n], soup.y[n], soup.angle[n])
        pasta.children[n].setAttribute("transform", transform)
        shadows.children[n].setAttribute("transform", transform)
      }
      // A tiny movement can leave the broth still before the pause ends, or
      // before a newly started message takes its first step.
      settled = settled && !stirring && soup.astray === 0
      frame = settled ? 0 : requestAnimationFrame(tick)
    }

    const run = () => {
      if (!frame && !settled && onScreen && !stillness.matches) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    }
    const pause = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    const stir = (event: PointerEvent) => {
      if (
        stillness.matches ||
        (event.pointerType !== "mouse" &&
          event.type === "pointermove" &&
          !pointers.has(event.pointerId))
      ) {
        return
      }
      const box = root.getBoundingClientRect()
      const scale = VIEW / UNIT / box.width
      const x = (event.clientX - box.left - box.width / 2) * scale
      const y = (event.clientY - box.top - box.height / 2) * scale
      const from = pointers.get(event.pointerId)
      pointers.set(event.pointerId, { x, y })
      if (from && (from.x !== x || from.y !== y)) {
        strokes.push(from.x, from.y, x, y)
        const now = performance.now()
        const locked = message !== null && (!spelled || now < protectedUntil)
        const fresh = stirs.move(now)
        // Stirring around a protected word does not request another message.
        // Once the hold ends, even an ongoing movement can release the word
        // and begin the next stir.
        if (!locked && (fresh || message)) {
          queue.stir()
          reletter()
        }
        stirring = true
        if (message && !locked) {
          message = null
          spelled = false
          protectedUntil = 0
          scatterSoup(soup)
          root.setAttribute("aria-label", LABEL)
        }
        settled = false
        run()
      }
    }
    const take = (event: PointerEvent) => {
      if (stillness.matches) {
        return
      }
      // A finger or pen keeps its stroke even if it slips off the bowl.
      // A mouse still stirs on hover, with no button held.
      if (event.pointerType !== "mouse") {
        root.setPointerCapture(event.pointerId)
      }
      stir(event)
    }
    const lift = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (root.hasPointerCapture(event.pointerId)) {
        root.releasePointerCapture(event.pointerId)
      }
    }
    const leave = (event: PointerEvent) => {
      if (!root.hasPointerCapture(event.pointerId)) {
        lift(event)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) {
        run()
      } else {
        pause()
        reletter()
      }
    })
    // Someone has just responded: their first names are the next message.
    const unhear = onSoupGuests((names) => {
      const guests = guestSoupMessage(names)
      // Not the letters of a message that is there to be read.
      const needed =
        guests &&
        (reletterSoup(chars, guests, undefined, (n) => soup.hold[n] > 0) ??
          reletterSoup(chars, guests))
      if (!guests || !needed) {
        return
      }
      queue.greet(guests)
      changes = needed
      if (!onScreen) {
        reletter()
      }
    })
    const settle = () => {
      // Claim one-finger gestures only while the bowl can respond. Pinch
      // zoom remains available, and static fallbacks scroll normally.
      root.toggleAttribute("data-stirrable", !stillness.matches)
      if (stillness.matches) {
        pause()
        strokes.length = 0
        for (const pointerId of pointers.keys()) {
          if (root.hasPointerCapture(pointerId)) {
            root.releasePointerCapture(pointerId)
          }
        }
        pointers.clear()
      } else {
        run()
      }
    }

    settle()
    observer.observe(root)
    stillness.addEventListener("change", settle)
    root.addEventListener("pointerdown", take)
    root.addEventListener("pointermove", stir)
    root.addEventListener("pointerleave", leave)
    root.addEventListener("pointerup", lift)
    root.addEventListener("pointercancel", lift)
    root.addEventListener("lostpointercapture", lift)

    return () => {
      pause()
      observer.disconnect()
      unhear()
      stillness.removeEventListener("change", settle)
      root.removeAttribute("data-stirrable")
      for (const pointerId of pointers.keys()) {
        if (root.hasPointerCapture(pointerId)) {
          root.releasePointerCapture(pointerId)
        }
      }
      root.removeEventListener("pointerdown", take)
      root.removeEventListener("pointermove", stir)
      root.removeEventListener("pointerleave", leave)
      root.removeEventListener("pointerup", lift)
      root.removeEventListener("pointercancel", lift)
      root.removeEventListener("lostpointercapture", lift)
    }
  }, [])

  const viewBox = `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`

  return (
    <div
      ref={rootRef}
      data-slot="alphabet-soup"
      role="img"
      aria-label={spells(SOUP_INVITATION)}
      // Clip hit testing to the circle so its empty corners still scroll.
      className={cn(
        "relative aspect-square select-none data-[stirrable]:touch-pinch-zoom [clip-path:circle(50%)] [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]",
        className
      )}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox={viewBox}
        className="absolute inset-0 size-full"
      >
        <defs>
          <radialGradient id="soup-shadow">
            <stop offset="0.86" stopColor="var(--foreground)" stopOpacity="0.13" />
            <stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="soup-rim" cx="0.38" cy="0.32" r="0.75">
            <stop offset="0.5" stopColor="var(--soup-bowl)" />
            <stop offset="1" stopColor="var(--soup-bowl-shade)" />
          </radialGradient>
          <radialGradient id="soup-well">
            <stop offset="0.9" stopColor="var(--soup-bowl-shade)" />
            <stop offset="1" stopColor="var(--soup-bowl)" />
          </radialGradient>
          <radialGradient id="soup-broth" cx="0.42" cy="0.38" r="0.66">
            <stop offset="0" stopColor="var(--soup-broth)" />
            <stop offset="1" stopColor="var(--soup-broth-deep)" />
          </radialGradient>
          <radialGradient id="soup-depth">
            <stop offset="0.82" stopColor="var(--soup-broth-shade)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--soup-broth-shade)" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="soup-sheen">
            <stop offset="0" stopColor="white" stopOpacity="0.1" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cy="7" r="213" fill="url(#soup-shadow)" />
        <circle r="204" fill="url(#soup-rim)" stroke="var(--border)" />
        <circle r={BROTH + 9} fill="url(#soup-well)" />
        <circle r={BROTH} fill="url(#soup-broth)" />
        <circle r={BROTH} fill="url(#soup-depth)" />
        <ellipse
          cx="-52"
          cy="-62"
          rx="92"
          ry="58"
          transform="rotate(-38 -52 -62)"
          fill="url(#soup-sheen)"
        />
      </svg>
      {/* The letters are a layer of their own, so that moving them does not
          repaint the bowl. */}
      <svg
        aria-hidden="true"
        viewBox={viewBox}
        className="pointer-events-none absolute inset-0 size-full font-sans text-[26px] font-bold will-change-transform"
        textAnchor="middle"
        strokeLinejoin="round"
        strokeWidth="2.4"
      >
        <g
          ref={shadowsRef}
          transform="translate(1.4 2.6)"
          fill="var(--soup-broth-shade)"
          stroke="var(--soup-broth-shade)"
        >
          {letters.map((letter, index) => (
            <g key={index} transform={place(letter.x, letter.y, letter.angle)}>
              <text y="0.36em">{letter.char}</text>
            </g>
          ))}
        </g>
        <g ref={pastaRef} fill="var(--soup-pasta)" stroke="var(--soup-pasta)">
          {letters.map((letter, index) => (
            <g key={index} transform={place(letter.x, letter.y, letter.angle)}>
              <text y="0.36em">{letter.char}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

export { AlphabetSoup }
