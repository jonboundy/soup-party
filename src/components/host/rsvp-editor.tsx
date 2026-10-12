"use client"

import * as React from "react"
import Link from "next/link"
import { unstable_rethrow } from "next/navigation"

import { removeHostRsvp, saveHostRsvp } from "@/app/host/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RecipeFields } from "@/components/recipe-fields"
import { guestNames } from "@/lib/guest-names"
import type { HostRsvpState } from "@/lib/host-form"
import {
  NAME_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
  type EditableRsvp,
  type RsvpErrors,
  type RsvpField,
} from "@/lib/rsvp-form"

type Action = (previous: HostRsvpState, formData: FormData) => Promise<HostRsvpState>

// A request that never completes throws instead of returning. It is reported
// the same way as a change the server could not save.
function reported(action: Action): Action {
  return async (previous, formData) => {
    try {
      return await action(previous, formData)
    } catch (error) {
      // A saved change arrives as a redirect back to the responses.
      unstable_rethrow(error)
      return { status: "failed" }
    }
  }
}

/** The host's form for correcting one guest's response, or removing it. */
function HostRsvpEditor({ id, initial }: { id: string; initial: EditableRsvp }) {
  const [saved, saveAction, saving] = React.useActionState(reported(saveHostRsvp), { status: "idle" })
  const [removed, removeAction, removing] = React.useActionState(reported(removeHostRsvp), { status: "idle" })
  const pending = saving || removing
  const [attendance, setAttendance] = React.useState(
    initial.status === "ATTENDING" ? "attending" : "declined"
  )
  const [soupName, setSoupName] = React.useState(initial.soup?.name ?? "")
  // Held here, not in the fields, which leave the form while the soup has no name.
  const [recipe, setRecipe] = React.useState({
    url: initial.soup?.recipeUrl ?? "",
    text: initial.soup?.recipeText ?? "",
  })
  const savedRecipe = !!(initial.soup?.recipeUrl || initial.soup?.recipeText)
  const [confirmRemove, setConfirmRemove] = React.useState(false)
  // Fields changed since the last response. Their errors no longer apply.
  const [corrected, setCorrected] = React.useState<RsvpField[]>([])
  const form = React.useRef<HTMLFormElement>(null)
  const removal = React.useRef<HTMLDivElement>(null)
  const outcome = React.useRef<HTMLHeadingElement>(null)
  const missing = saved.status === "missing" || removed.status === "missing"

  React.useEffect(() => {
    if (confirmRemove) removal.current?.querySelector<HTMLElement>("[type=submit]")?.focus()
  }, [confirmRemove])

  // After a rejected save, focus goes to the first field that needs
  // correcting, or back to the button when nothing was saved.
  React.useEffect(() => {
    if (saved.status === "invalid") {
      form.current
        ?.querySelector<HTMLElement>("[aria-invalid=true]:not([type=hidden])")
        ?.focus()
    } else if (saved.status === "failed") {
      form.current?.querySelector<HTMLElement>("[type=submit]")?.focus()
    }
  }, [saved])

  React.useEffect(() => {
    if (missing) outcome.current?.focus()
  }, [missing])

  if (missing) {
    return <div className="flex max-w-md flex-col gap-3">
      <h2 ref={outcome} tabIndex={-1} className="type-heading outline-none">
        This response is no longer here.
      </h2>
      <p className="text-muted-foreground">It has been removed. Nothing was changed.</p>
      <Link href="/host" className="underline underline-offset-4">Back to the responses</Link>
    </div>
  }

  const errors: RsvpErrors = {}
  if (saved.status === "invalid") {
    for (const field of Object.keys(saved.errors) as RsvpField[]) {
      if (!corrected.includes(field)) errors[field] = saved.errors[field]
    }
  }

  function correct(field: RsvpField) {
    if (errors[field]) setCorrected([...corrected, field])
  }

  return (
    <div className="max-w-md">
      <form
        ref={form}
        action={saveAction}
        // Otherwise submitted by hand: React resets a form once its action has
        // run, which would clear the answers after an error.
        onSubmit={(event) => {
          event.preventDefault()
          if (pending) return
          const formData = new FormData(event.currentTarget)
          React.startTransition(() => {
            // Inside the transition so it lands together with the response.
            setCorrected([])
            saveAction(formData)
          })
        }}
        noValidate
      >
        <input type="hidden" name="rsvpId" value={id} />
        <FieldGroup className="gap-7">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="host-rsvp-name">Name</FieldLabel>
            <Input
              id="host-rsvp-name"
              name="name"
              autoComplete="off"
              autoCapitalize="words"
              maxLength={NAME_MAX_LENGTH}
              required
              defaultValue={initial.attendeeName}
              onChange={() => correct("name")}
              aria-invalid={!!errors.name}
              aria-describedby={
                errors.name ? "host-rsvp-name-error" : "host-rsvp-name-description"
              }
            />
            {errors.name ? (
              // The shared message addresses a guest.
              <FieldError id="host-rsvp-name-error">
                {errors.name.replace("your name", "a name")}
              </FieldError>
            ) : (
              <FieldDescription id="host-rsvp-name-description">
                First names appear beside their soup.
              </FieldDescription>
            )}
          </Field>
          <Field data-invalid={!!errors.secondName}>
            <FieldLabel htmlFor="host-rsvp-second-name">Second guest</FieldLabel>
            <Input
              id="host-rsvp-second-name"
              name="secondName"
              autoComplete="off"
              autoCapitalize="words"
              maxLength={NAME_MAX_LENGTH}
              defaultValue={initial.secondName ?? undefined}
              onChange={() => correct("secondName")}
              aria-invalid={!!errors.secondName}
              aria-describedby={
                errors.secondName
                  ? "host-rsvp-second-name-error"
                  : "host-rsvp-second-name-description"
              }
            />
            {errors.secondName ? (
              <FieldError id="host-rsvp-second-name-error">
                {errors.secondName}
              </FieldError>
            ) : (
              <FieldDescription id="host-rsvp-second-name-description">
                Blank for a guest on their own.
              </FieldDescription>
            )}
          </Field>
          <FieldSet data-invalid={!!errors.attendance}>
            <FieldLegend id="host-rsvp-attendance-legend" variant="label">
              Response
            </FieldLegend>
            <RadioGroup
              name="attendance"
              value={attendance}
              onValueChange={(value) => {
                setAttendance(value)
                correct("attendance")
              }}
              required
              aria-labelledby="host-rsvp-attendance-legend"
              aria-describedby={
                errors.attendance ? "host-rsvp-attendance-error" : undefined
              }
            >
              <Field orientation="horizontal">
                <RadioGroupItem
                  value="attending"
                  id="host-rsvp-attending"
                  aria-invalid={!!errors.attendance}
                />
                <FieldLabel htmlFor="host-rsvp-attending" className="font-normal">
                  Attending
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem
                  value="declined"
                  id="host-rsvp-declined"
                  aria-invalid={!!errors.attendance}
                />
                <FieldLabel htmlFor="host-rsvp-declined" className="font-normal">
                  Declined
                </FieldLabel>
              </Field>
            </RadioGroup>
            {errors.attendance && (
              <FieldError id="host-rsvp-attendance-error">
                {errors.attendance}
              </FieldError>
            )}
            {attendance === "declined" && initial.soup && (
              <FieldDescription>
                {initial.soup.name} stays on file, unlisted, in case their plans change.
              </FieldDescription>
            )}
          </FieldSet>
          {attendance === "attending" && (
            <Field data-invalid={!!errors.soupName}>
              <FieldLabel htmlFor="host-rsvp-soup-name">Soup</FieldLabel>
              <Input
                id="host-rsvp-soup-name"
                name="soupName"
                autoComplete="off"
                maxLength={SOUP_NAME_MAX_LENGTH}
                value={soupName}
                onChange={(event) => {
                  setSoupName(event.target.value)
                  correct("soupName")
                }}
                aria-invalid={!!errors.soupName}
                aria-describedby={
                  errors.soupName
                    ? "host-rsvp-soup-name-error"
                    : "host-rsvp-soup-name-description"
                }
              />
              {errors.soupName ? (
                <FieldError id="host-rsvp-soup-name-error">
                  {errors.soupName}
                </FieldError>
              ) : (
                <FieldDescription id="host-rsvp-soup-name-description">
                  {savedRecipe
                    ? "Clear the name to remove the soup and its recipe."
                    : initial.soup
                      ? "Clear the name to remove the soup."
                      : "Blank while the guest is undecided."}
                </FieldDescription>
              )}
            </Field>
          )}
          {attendance === "attending" && soupName.trim() !== "" && (
            <RecipeFields
              id="host-rsvp"
              description="Optional. A link, the recipe written out, or both. Public once saved."
              value={recipe}
              onChange={setRecipe}
              errors={errors}
              onCorrect={correct}
            />
          )}
          {saved.status === "failed" && (
            <Alert variant="destructive">
              <AlertTitle>The changes could not be saved.</AlertTitle>
              <AlertDescription>Try again.</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button type="submit" size="lg" disabled={pending}>
              {saving ? "Saving" : "Save changes"}
            </Button>
            <Link href="/host" className="underline underline-offset-4">
              Back to the responses
            </Link>
          </div>
        </FieldGroup>
      </form>
      <div ref={removal} className="mt-7 flex flex-col gap-3 border-t pt-7">
        {confirmRemove ? (
          <form action={removeAction} className="flex flex-col gap-3">
            <input type="hidden" name="rsvpId" value={id} />
            <input type="hidden" name="confirmRemove" value="yes" />
            <p className="font-medium [overflow-wrap:anywhere]">
              Remove {guestNames(initial)}&rsquo;s response?
            </p>
            <p className="text-sm text-muted-foreground">
              {initial.soup
                ? `The response and its soup${savedRecipe ? ", with its recipe," : ""} will be deleted, and the guest’s private link will stop working.`
                : "The response will be deleted, and the guest’s private link will stop working."}
              {" "}This cannot be undone.
            </p>
            {removed.status === "failed" && (
              <Alert variant="destructive">
                <AlertTitle>The response could not be removed.</AlertTitle>
                <AlertDescription>Try again.</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="destructive" disabled={pending}>
                {removing ? "Removing" : "Yes, remove it"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmRemove(false)}
              >
                Keep it
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="self-start"
            onClick={() => setConfirmRemove(true)}
          >
            Remove response
          </Button>
        )}
      </div>
    </div>
  )
}

export { HostRsvpEditor }
