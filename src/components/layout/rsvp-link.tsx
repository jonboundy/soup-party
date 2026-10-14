import { Suspense } from "react"
import Link from "next/link"
import { getRememberedRsvp } from "@/lib/remembered-rsvp"

async function RsvpLinkLabel({ newLabel }: { newLabel: string }) {
  const rsvp = await getRememberedRsvp()
  return rsvp.status === "new" ? newLabel : "Your RSVP"
}

function RsvpLink({ className, newLabel }: { className: string; newLabel: string }) {
  return (
    <Link href="/#rsvp" className={className}>
      <Suspense fallback={<span className="inline-block w-16" aria-label="Loading RSVP…">…</span>}>
        <RsvpLinkLabel newLabel={newLabel} />
      </Suspense>
    </Link>
  )
}

export { RsvpLink }
