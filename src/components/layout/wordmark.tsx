import * as React from "react"
import { cn } from "cn"

// The favicon's bowl of tomato soup. The steam takes up the top fifth, so the
// bowl is lifted by that much to sit level with the name rather than centring
// the steam and bowl together.
function Bowl({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="-50 -62 100 104"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-7 shrink-0 overflow-visible", className)}
      {...props}
    >
      {/* Rises and thickens a little when a link wrapping the wordmark is
          hovered. */}
      <g className="opacity-50 transition duration-300 ease-out group-hover/wordmark:-translate-y-1.5 group-hover/wordmark:opacity-90">
        <path d="M-15 -24c-7-8 7-12 0-21" />
        <path d="M0 -27c-7-8 7-12 0-21" />
        <path d="M15 -24c-7-8 7-12 0-21" />
      </g>
      <path
        d="M-40 -8C-40 16-24 30 0 30S40 16 40 -8"
        fill="var(--soup-bowl)"
      />
      <ellipse cy="-8" rx="40" ry="7.5" fill="var(--soup-broth)" />
      <path d="M-15 30.5l-2 6h34l-2-6" fill="var(--soup-bowl)" />
    </svg>
  )
}

function Wordmark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        "inline-flex items-center gap-2.5 text-base font-semibold tracking-tight whitespace-nowrap",
        className
      )}
      {...props}
    >
      <Bowl className="-translate-y-[20%]" />
      Soup Party
    </span>
  )
}

export { Wordmark }
