import * as React from "react"

import { layoutSoupCascade } from "@/lib/soup-cascade"

// Tomato, pea, squash, chowder, borscht and chicken.
const BROTHS = [
  "--soup-broth",
  "--soup-pea",
  "--soup-squash",
  "--soup-chowder",
  "--soup-borscht",
  "--soup-chicken",
]
const bowls = layoutSoupCascade(BROTHS.length)
// A phone is too narrow for them all.
const NARROW_BOWLS = 7

// Small steaming bowls of soup, drawn in line, falling slowly behind the home
// page. Decoration only: it is hidden from assistive technology, takes no
// pointer events, and sits under everything else. It is markup and CSS with
// no script, so it costs nothing to load; the motion and its reduced-motion
// stillness are in globals.css.
function SoupCascade() {
  return (
    <div
      aria-hidden="true"
      data-slot="soup-cascade"
      className="pointer-events-none fixed inset-0 -z-10 print:hidden"
    >
      {bowls.map((bowl, index) => (
        <span
          key={index}
          data-depth={bowl.depth}
          className={index < NARROW_BOWLS ? undefined : "max-sm:hidden"}
          style={
            {
              "--x": `${bowl.x * 100}%`,
              "--start": bowl.start,
              "--seconds": `${bowl.seconds}s`,
              "--drift": `${bowl.drift}rem`,
            } as React.CSSProperties
          }
        >
          <svg
            viewBox="-50 -62 100 104"
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g opacity="0.55">
              <path d="M-15 -24c-7-8 7-12 0-21" />
              <path d="M0 -27c-7-8 7-12 0-21" />
              <path d="M15 -24c-7-8 7-12 0-21" />
            </g>
            <path
              d="M-40 -8C-40 16-24 30 0 30S40 16 40 -8"
              fill="var(--soup-bowl)"
            />
            <ellipse
              cy="-8"
              rx="40"
              ry="7.5"
              fill={`var(${BROTHS[bowl.soup]})`}
            />
            <path d="M-15 30.5l-2 6h34l-2-6" />
          </svg>
        </span>
      ))}
    </div>
  )
}

export { SoupCascade }
