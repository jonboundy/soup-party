"use client"

import * as React from "react"

// Fades its children up, one after another, the first time it scrolls into
// view. The motion itself is in globals.css. Children are only hidden after
// the browser has confirmed they are below the fold and that motion is
// welcome, so they stay visible without JavaScript, with reduced motion, and
// when the page loads already scrolled to them.
function Reveal({
  as = "div",
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "dl" }) {
  // Widened so one ref can serve either element.
  const Comp = as as React.ElementType
  const ref = React.useRef<HTMLElement>(null)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }
    const { top } = element.getBoundingClientRect()
    if (top < window.innerHeight) {
      return
    }

    // Waits until the content is well into the viewport, where it will be
    // seen, but never further up than the end of the page lets it scroll.
    const roomBelow =
      document.documentElement.scrollHeight - window.scrollY - top
    const inset = Math.round(Math.min(window.innerHeight * 0.18, roomBelow / 2))

    element.dataset.reveal = "pending"
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.dataset.reveal = "shown"
          observer.disconnect()
        }
      },
      { rootMargin: `0px 0px -${inset}px 0px` }
    )
    observer.observe(element)

    return () => {
      observer.disconnect()
      delete element.dataset.reveal
    }
  }, [])

  return <Comp ref={ref} data-slot="reveal" {...props} />
}

export { Reveal }
