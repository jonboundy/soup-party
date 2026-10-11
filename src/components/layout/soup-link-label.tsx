"use client"

import { useLinkStatus } from "next/link"

/** Navigation waits for the server-rendered registry, with a quiet pending label. */
function SoupLinkLabel() {
  const { pending } = useLinkStatus()

  return (
    <span aria-live="polite">
      {pending ? (
        <>
          Loading…<span className="sr-only"> soups</span>
        </>
      ) : (
        "Soups"
      )}
    </span>
  )
}

export { SoupLinkLabel }
