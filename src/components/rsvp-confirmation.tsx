"use client"

import * as React from "react"
import Link from "next/link"

import { PrivateEditLink } from "@/components/private-edit-link"
import type { RsvpFormState } from "@/lib/rsvp-form"

function Entry({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-baseline gap-4 border-b py-4">
      <dt className="type-eyebrow text-muted-foreground">{term}</dt>
      <dd className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/** A receipt for a saved response: what was recorded, and the link back to it. */
function RsvpConfirmation({
  state,
  editing,
}: {
  state: Extract<RsvpFormState, { editPath: string }>
  editing: boolean
}) {
  const title = React.useRef<HTMLHeadingElement>(null)
  // The edit page has no section title above this one. The homepage does.
  const Title = editing ? "h2" : "h3"

  // The form, and whatever had focus in it, is gone. Focus moves here so
  // keyboard and screen reader users land on the outcome.
  React.useEffect(() => {
    title.current?.focus()
  }, [])

  return (
    <div className="flex max-w-md animate-in flex-col gap-8 duration-500 fade-in-0">
      <div className="flex flex-col gap-2">
        <Title ref={title} tabIndex={-1} className="type-heading outline-none">
          {state.status === "cancelled"
            ? "Your RSVP has been cancelled."
            : editing
              ? "Your RSVP has been updated."
              : state.status === "attending"
                ? "You’re on the list."
                : "Your regrets have been recorded."}
        </Title>
        {state.status === "attending" && state.soup && (
          <p className="type-lead text-muted-foreground">
            Your soup has been registered.
          </p>
        )}
      </div>
      <dl className="border-t">
        <Entry term={state.secondName ? "Names" : "Name"}>
          <p>{state.name}</p>
          {state.secondName && <p>{state.secondName}</p>}
        </Entry>
        <Entry term="Response">
          {state.status === "attending" ? "Attending" : "Not attending"}
        </Entry>
        {state.status === "attending" ? (
          <Entry term="Soup">
            {state.soup ? (
              <p>{state.soup.name}</p>
            ) : (
              <>
                <p>To be decided.</p>
                <Note>Add it at any time with your private edit link.</Note>
              </>
            )}
          </Entry>
        ) : (
          state.unlistedSoup && (
            <Entry term="Soup">
              <p>{state.unlistedSoup}</p>
              <Note>No longer listed. Kept in case your plans change.</Note>
            </Entry>
          )
        )}
        {state.status === "attending" && state.soup && (
          <Entry term="Recipe">
            {state.soup.recipeUrl || state.soup.recipeText || state.photos?.saved ? (
              <>
                <p>Provided.</p>
                <Note>Anyone can read it from the soup list.</Note>
              </>
            ) : (
              <>
                <p>Not provided.</p>
                <Note>Add one at any time with your private edit link.</Note>
              </>
            )}
            {!!state.photos?.unsaved && (
              // The response is saved all the same. Only the photos are not.
              <p role="alert" className="text-sm text-destructive">
                {state.photos.unsaved === 1
                  ? "One change to the photos could not be saved."
                  : `${state.photos.unsaved} changes to the photos could not be saved.`}{" "}
                Make {state.photos.unsaved === 1 ? "it" : "them"} again with your private edit link.
              </p>
            )}
          </Entry>
        )}
      </dl>
      <PrivateEditLink
        editPath={state.editPath}
        description={`${
          state.status === "attending"
            ? "Use it to change your RSVP or cancel."
            : "Use it if your plans change."
        }${
          // A reload starts a new form. The edit page is the link itself.
          editing ? "" : " It will not be shown again."
        } Anyone with this link can edit your response.`}
      />
      {editing && (
        <Link href="/" className="self-start underline underline-offset-4">
          Back to Soup Party
        </Link>
      )}
    </div>
  )
}

export { RsvpConfirmation }
