import * as React from "react"
import Link from "next/link"
import { unstable_rethrow } from "next/navigation"

import { guestNames } from "@/lib/guest-names"
import type { HostOverview, HostRsvp } from "@/lib/host-rsvps"

function people(count: number | null) {
  return count === 1 ? "1 person" : `${count} people`
}

function timeFormatter(timeZone: string | null) {
  const options = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  } as const
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timeZone ?? "UTC" })
  } catch {
    // An unrecognized zone. UTC is labelled as such, so it is never misread.
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" })
  }
}

function Figure({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    // Reversed so the number sits above its label while the term still comes first.
    <div className="flex flex-col-reverse gap-2 border-b py-5 sm:border-b-0 sm:py-0">
      <dt className="type-eyebrow text-muted-foreground">{term}</dt>
      <dd className="type-title tabular-nums">{children}</dd>
    </div>
  )
}

function Group({
  id,
  title,
  count,
  empty,
  children,
}: {
  id: string
  title: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="space-y-5">
      <h2 id={id} className="type-heading">
        {title} <span className="font-normal text-muted-foreground tabular-nums">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="border-t pt-5 text-muted-foreground">{empty}</p>
      ) : (
        <ul aria-labelledby={id} className="border-t">
          {children}
        </ul>
      )}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="grid gap-3 border-b py-5 sm:grid-cols-2 sm:gap-8 [overflow-wrap:anywhere]">
      {children}
    </li>
  )
}

function Times({ rsvp, format }: { rsvp: HostRsvp; format: Intl.DateTimeFormat }) {
  const edited = rsvp.updatedAt.getTime() !== rsvp.createdAt.getTime()
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      Received <time dateTime={rsvp.createdAt.toISOString()}>{format.format(rsvp.createdAt)}</time>
      {edited && (
        <>
          . Changed{" "}
          <time dateTime={rsvp.updatedAt.toISOString()}>{format.format(rsvp.updatedAt)}</time>
        </>
      )}
      .
    </p>
  )
}

function EditLink({ rsvp }: { rsvp: HostRsvp }) {
  return (
    <Link
      href={`/host/rsvps/${rsvp.id}`}
      aria-label={`Edit ${guestNames(rsvp)}’s response`}
      className="mt-2 inline-block text-sm underline underline-offset-4"
    >
      Edit
    </Link>
  )
}

/** The host's overview. The data read behind it checks the session itself. */
async function HostDashboard() {
  let overview: HostOverview
  try {
    // Imported here because the client cannot be constructed without a database.
    const { getHostOverview } = await import("@/lib/host-rsvps")
    overview = await getHostOverview()
  } catch (error) {
    // Preserve the redirect for a session that ended, and other framework signals.
    unstable_rethrow(error)
    // Database errors may quote guests' details; log only their kind.
    console.error(
      "Host overview could not be loaded:",
      error instanceof Error ? error.name : typeof error
    )
    return (
      <div className="space-y-3" role="alert">
        <h2 className="type-heading">The responses could not be loaded.</h2>
        <p className="text-muted-foreground">Try reloading the page.</p>
      </div>
    )
  }

  const { counts, attending, declined, soups, undecided } = overview
  const format = timeFormatter(overview.timeZone)

  return (
    <div className="space-y-14 sm:space-y-20">
      <section aria-labelledby="host-summary" className="space-y-5">
        <h2 id="host-summary" className="sr-only">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 border-t sm:grid-cols-5 sm:border-y sm:py-8">
          <div className="col-span-2 sm:col-span-1">
            <Figure term="Guests expected">{counts.guests}</Figure>
          </div>
          <Figure term="Attending">{counts.attending}</Figure>
          <Figure term="Declined">{counts.declined}</Figure>
          <Figure term="Soups">{counts.soups}</Figure>
          <Figure term="Undecided">{counts.undecided}</Figure>
        </dl>
        <p className="text-sm text-muted-foreground">
          Guests expected counts everyone in each party. The other figures count responses.
          Reload the page for the latest. Edit a response to correct or remove it.
        </p>
      </section>

      <Group id="host-attending" title="Attending." count={counts.attending} empty="Nobody yet.">
        {attending.map((rsvp) => (
          <Row key={rsvp.id}>
            <div>
              <h3 className="font-medium">{guestNames(rsvp)}</h3>
              <p className="text-muted-foreground">{people(rsvp.partySize)}</p>
              <Times rsvp={rsvp} format={format} />
              <EditLink rsvp={rsvp} />
            </div>
            <div>
              {rsvp.soup ? (
                <>
                  <p className="font-medium">{rsvp.soup.name}</p>
                  {rsvp.soup.recipePath && (
                    <Link
                      href={rsvp.soup.recipePath}
                      aria-label={`Recipe for ${rsvp.soup.name}`}
                      className="mt-2 inline-block text-sm underline underline-offset-4"
                    >
                      Recipe
                    </Link>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Soup to be decided.</p>
              )}
            </div>
          </Row>
        ))}
      </Group>

      <Group id="host-soups" title="Soups." count={counts.soups} empty="No soups yet.">
        {soups.map((soup, index) => (
          <Row key={index}>
            <h3 className="font-medium">{soup.name}</h3>
            <p className="text-muted-foreground">Brought by {soup.guests}</p>
          </Row>
        ))}
      </Group>

      <Group
        id="host-undecided"
        title="Undecided soups."
        count={counts.undecided}
        empty="Nobody attending is without a soup."
      >
        {undecided.map((rsvp) => (
          <Row key={rsvp.id}>
            <h3 className="font-medium">{guestNames(rsvp)}</h3>
            <p className="text-muted-foreground">{people(rsvp.partySize)}</p>
          </Row>
        ))}
      </Group>

      <Group id="host-declined" title="Declined." count={counts.declined} empty="Nobody yet.">
        {declined.map((rsvp) => (
          <Row key={rsvp.id}>
            <div>
              <h3 className="font-medium">{guestNames(rsvp)}</h3>
              <Times rsvp={rsvp} format={format} />
              <EditLink rsvp={rsvp} />
            </div>
            {rsvp.soup && (
              <div>
                <p className="font-medium">{rsvp.soup.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Not listed. Kept in case their plans change.
                </p>
              </div>
            )}
          </Row>
        ))}
      </Group>
    </div>
  )
}

export { HostDashboard }
