"use client"

import * as React from "react"
import { cn } from "cn"

import {
  createSoup,
  layoutSoupLetters,
  stepSoup,
  stirSoup,
  swirlSoup,
} from "@/lib/alphabet-soup"

// The drawing's units. The broth that moves stops half a letter short of the
// broth that is drawn, so a letter carried to its edge stays clear of the bowl.
const VIEW = 440
const BROTH = 152
const UNIT = 138
// How fast the soup is turning when it is first seen, in degrees a second.
const SERVED_SWIRL = 26

const letters = layoutSoupLetters()

function place(x: number, y: number, angle: number) {
  return `translate(${(x * UNIT).toFixed(2)} ${(y * UNIT).toFixed(2)}) rotate(${angle.toFixed(1)})`
}

// A bowl of alphabet soup, seen from above, that can be stirred with a cursor
// or a finger. The server renders it complete and still, which is how it stays
// without JavaScript and with reduced motion. Otherwise it turns a little when
// first seen, and runs only while it is on screen and has not yet settled.
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

      for (let n = 0; n < soup.letters; n++) {
        const transform = place(soup.x[n], soup.y[n], soup.angle[n])
        pasta.children[n].setAttribute("transform", transform)
        shadows.children[n].setAttribute("transform", transform)
      }
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
      if (stillness.matches) {
        return
      }
      const box = root.getBoundingClientRect()
      const scale = VIEW / UNIT / box.width
      const x = (event.clientX - box.left - box.width / 2) * scale
      const y = (event.clientY - box.top - box.height / 2) * scale
      const from = pointers.get(event.pointerId)
      pointers.set(event.pointerId, { x, y })
      if (from) {
        strokes.push(from.x, from.y, x, y)
        settled = false
        run()
      }
    }
    const lift = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
    }

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) {
        run()
      } else {
        pause()
      }
    })
    const settle = () => {
      if (stillness.matches) {
        pause()
        strokes.length = 0
      } else {
        run()
      }
    }

    observer.observe(root)
    stillness.addEventListener("change", settle)
    root.addEventListener("pointerdown", stir)
    root.addEventListener("pointermove", stir)
    root.addEventListener("pointerleave", lift)
    root.addEventListener("pointercancel", lift)

    return () => {
      pause()
      observer.disconnect()
      stillness.removeEventListener("change", settle)
      root.removeEventListener("pointerdown", stir)
      root.removeEventListener("pointermove", stir)
      root.removeEventListener("pointerleave", lift)
      root.removeEventListener("pointercancel", lift)
    }
  }, [])

  const viewBox = `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`

  return (
    <div
      ref={rootRef}
      data-slot="alphabet-soup"
      role="img"
      aria-label="A bowl of alphabet soup."
      // Vertical swipes still scroll the page; anything else stirs.
      className={cn(
        "relative aspect-square touch-pan-y select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]",
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
