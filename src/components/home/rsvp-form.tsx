"use client"

import * as React from "react"
import Link from "next/link"

import { cancelGuestRsvp, editRsvp, submitRsvp } from "@/app/actions"
import { RsvpConfirmation } from "@/components/rsvp-confirmation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  MAX_PARTY_SIZE,
  NAME_MAX_LENGTH,
  SOUP_DESCRIPTION_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
  type RsvpErrors,
  type RsvpField,
  type RsvpFormState,
  type EditableRsvp,
} from "@/lib/rsvp-form"
import { SOUP_CATEGORIES } from "@/lib/soup-categories"

const partySizes = Array.from({ length: MAX_PARTY_SIZE }, (_, index) => ({
  label: index === 0 ? "1 person" : `${index + 1} people`,
  value: String(index + 1),
}))

// A request that never completes, because the guest is offline or the site
// was redeployed mid-visit, throws instead of returning. It is reported the
// same way as a response the server could not save.
async function submit(
  previous: RsvpFormState,
  formData: FormData,
  editing: boolean,
): Promise<RsvpFormState> {
  try {
    if (editing && formData.get("confirmCancel") === "yes") {
      return await cancelGuestRsvp(previous, formData)
    }
    return await (editing ? editRsvp : submitRsvp)(previous, formData)
  } catch {
    return { status: "failed" }
  }
}

function RsvpForm({
  initial,
  editToken,
  submissionToken,
}: {
  initial?: EditableRsvp
  editToken?: string
  submissionToken?: string
}) {
  const editing = !!editToken
  const [state, formAction, pending] = React.useActionState<
    RsvpFormState,
    FormData
  >((previous, data) => submit(previous, data, editing), { status: "idle" })
  const [attendance, setAttendance] = React.useState(
    initial ? initial.status === "ATTENDING" ? "attending" : "declined" : ""
  )
  const [partySize, setPartySize] = React.useState(String(initial?.partySize ?? 1))
  const [soupName, setSoupName] = React.useState(initial?.soup?.name ?? "")
  const [soupCategory, setSoupCategory] = React.useState<string | null>(
    initial?.soup?.category ?? null
  )
  const [soupDescription, setSoupDescription] = React.useState(
    initial?.soup?.description ?? ""
  )
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const outcome = React.useRef<HTMLHeadingElement>(null)
  // Fields changed since the last response. Their errors no longer apply.
  const [corrected, setCorrected] = React.useState<RsvpField[]>([])
  const form = React.useRef<HTMLFormElement>(null)

  React.useEffect(() => {
    if (confirmCancel) {
      form.current?.querySelector<HTMLElement>("#rsvp-confirm-cancel")?.focus()
    }
  }, [confirmCancel])

  // After a rejected submission, focus goes to the first field that needs
  // correcting, or back to the button when the response was not saved.
  React.useEffect(() => {
    if (state.status === "invalid") {
      form.current
        ?.querySelector<HTMLElement>("[aria-invalid=true]:not([type=hidden])")
        ?.focus()
    } else if (state.status === "failed" || state.status === "rate-limited" || state.status === "conflict") {
      form.current?.querySelector<HTMLElement>("[type=submit]")?.focus()
    } else if (state.status === "duplicate") {
      form.current?.querySelector<HTMLElement>("#rsvp-duplicate-title")?.focus()
    }
    if (state.status === "unauthorized") outcome.current?.focus()
  }, [state])

  if (state.status === "attending" || state.status === "declined" || state.status === "cancelled") {
    return <RsvpConfirmation state={state} editing={editing} />
  }

  if (state.status === "unauthorized") {
    return <div className="flex max-w-md flex-col gap-3">
      <h2 ref={outcome} tabIndex={-1} className="type-heading outline-none">
        This edit link is not valid.
      </h2>
      <p className="text-muted-foreground">
        Open the private link saved from your RSVP confirmation.
      </p>
      <Link href="/" className="underline underline-offset-4">Back to Soup Party</Link>
    </div>
  }

  const errors: RsvpErrors = {}
  if (state.status === "invalid") {
    for (const field of Object.keys(state.errors) as RsvpField[]) {
      if (!corrected.includes(field)) errors[field] = state.errors[field]
    }
  }

  function correct(field: RsvpField) {
    if (errors[field]) setCorrected([...corrected, field])
  }

  const warning =
    state.status === "duplicate" &&
    attendance === "attending" &&
    soupName.trim().replace(/\s+/g, " ") === state.soupName
      ? state
      : null

  return (
    <form
      ref={form}
      // Lets React hold a submission made before the page is interactive
      // and send it once it is.
      action={formAction}
      // Otherwise submitted by hand: React resets a form once its action has
      // run, which would clear the guest's answers after an error.
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const formData = new FormData(event.currentTarget)
        React.startTransition(() => {
          // Inside the transition so it lands together with the response.
          setCorrected([])
          formAction(formData)
        })
      }}
      noValidate
      className="max-w-md"
    >
      {editing && <input type="hidden" name="editToken" value={editToken} />}
      {!editing && <input type="hidden" name="submissionToken" value={submissionToken} />}
      <div hidden aria-hidden="true">
        <label htmlFor="rsvp-website">Website</label>
        <input id="rsvp-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <FieldGroup className="gap-7">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="rsvp-name">Name</FieldLabel>
          <Input
            id="rsvp-name"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={NAME_MAX_LENGTH}
            required
            defaultValue={initial?.attendeeName}
            onChange={() => correct("name")}
            aria-invalid={!!errors.name}
            aria-describedby={
              errors.name ? "rsvp-name-error" : "rsvp-name-description"
            }
          />
          {errors.name ? (
            <FieldError id="rsvp-name-error">{errors.name}</FieldError>
          ) : (
            <FieldDescription id="rsvp-name-description">
              Only your first name will appear beside your soup.
            </FieldDescription>
          )}
        </Field>
        <FieldSet data-invalid={!!errors.attendance}>
          <FieldLegend id="rsvp-attendance-legend" variant="label">
            Attendance
          </FieldLegend>
          <RadioGroup
            name="attendance"
            value={attendance}
            onValueChange={(value) => {
              setAttendance(value)
              correct("attendance")
            }}
            required
            aria-labelledby="rsvp-attendance-legend"
            aria-describedby={
              errors.attendance ? "rsvp-attendance-error" : undefined
            }
          >
            <Field orientation="horizontal">
              <RadioGroupItem
                value="attending"
                id="rsvp-attending"
                aria-invalid={!!errors.attendance}
              />
              <FieldLabel htmlFor="rsvp-attending" className="font-normal">
                I&apos;ll be there
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <RadioGroupItem
                value="declined"
                id="rsvp-declined"
                aria-invalid={!!errors.attendance}
              />
              <FieldLabel htmlFor="rsvp-declined" className="font-normal">
                I can&apos;t make it
              </FieldLabel>
            </Field>
          </RadioGroup>
          {errors.attendance && (
            <FieldError id="rsvp-attendance-error">
              {errors.attendance}
            </FieldError>
          )}
        </FieldSet>
        {attendance === "attending" && (
          <Field data-invalid={!!errors.partySize}>
            <FieldLabel htmlFor="rsvp-party-size">Party size</FieldLabel>
            <Select
              name="partySize"
              items={partySizes}
              value={partySize}
              onValueChange={(value) => {
                setPartySize(value ?? "1")
                correct("partySize")
              }}
            >
              <SelectTrigger
                id="rsvp-party-size"
                className="w-full"
                aria-invalid={!!errors.partySize}
                aria-describedby={
                  errors.partySize
                    ? "rsvp-party-size-error"
                    : "rsvp-party-size-description"
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partySizes.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.partySize ? (
              <FieldError id="rsvp-party-size-error">
                {errors.partySize}
              </FieldError>
            ) : (
              <FieldDescription id="rsvp-party-size-description">
                Including you.
              </FieldDescription>
            )}
          </Field>
        )}
        {attendance === "attending" && (
          <Field data-invalid={!!errors.soupName}>
            <FieldLabel htmlFor="rsvp-soup-name">Soup</FieldLabel>
            <Input
              id="rsvp-soup-name"
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
                  ? "rsvp-soup-name-error"
                  : "rsvp-soup-name-description"
              }
            />
            {errors.soupName ? (
              <FieldError id="rsvp-soup-name-error">
                {errors.soupName}
              </FieldError>
            ) : (
              <FieldDescription id="rsvp-soup-name-description">
                Leave blank to decide later.
              </FieldDescription>
            )}
          </Field>
        )}
        {/* A soup needs a name before it can be categorized or described. */}
        {attendance === "attending" && soupName.trim() !== "" && (
          <>
            <Field data-invalid={!!errors.soupCategory}>
              <FieldLabel htmlFor="rsvp-soup-category">Soup category</FieldLabel>
              <Select
                name="soupCategory"
                items={SOUP_CATEGORIES}
                value={soupCategory}
                onValueChange={(value) => {
                  setSoupCategory(value)
                  correct("soupCategory")
                }}
              >
                <SelectTrigger
                  id="rsvp-soup-category"
                  className="w-full"
                  aria-invalid={!!errors.soupCategory}
                  aria-describedby={
                    errors.soupCategory ? "rsvp-soup-category-error" : undefined
                  }
                >
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {SOUP_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.soupCategory && (
                <FieldError id="rsvp-soup-category-error">
                  {errors.soupCategory}
                </FieldError>
              )}
            </Field>
            <Field data-invalid={!!errors.soupDescription}>
              <FieldLabel htmlFor="rsvp-soup-description">
                Soup description
              </FieldLabel>
              <Textarea
                id="rsvp-soup-description"
                name="soupDescription"
                maxLength={SOUP_DESCRIPTION_MAX_LENGTH}
                value={soupDescription}
                onChange={(event) => {
                  setSoupDescription(event.target.value)
                  correct("soupDescription")
                }}
                aria-invalid={!!errors.soupDescription}
                aria-describedby={
                  errors.soupDescription
                    ? "rsvp-soup-description-error"
                    : "rsvp-soup-description-description"
                }
              />
              {errors.soupDescription ? (
                <FieldError id="rsvp-soup-description-error">
                  {errors.soupDescription}
                </FieldError>
              ) : (
                <FieldDescription id="rsvp-soup-description-description">
                  Optional.
                </FieldDescription>
              )}
            </Field>
          </>
        )}
        {state.status === "failed" && (
          <Alert variant="destructive">
            <AlertTitle>The RSVP could not be saved.</AlertTitle>
            <AlertDescription>Try again.</AlertDescription>
          </Alert>
        )}
        {state.status === "rate-limited" && (
          <Alert variant="destructive">
            <AlertTitle>Please wait before trying again.</AlertTitle>
            <AlertDescription>Your answers are still here. Try again in {Math.ceil(state.retryAfter / 60)} {state.retryAfter > 60 ? "minutes" : "minute"}.</AlertDescription>
          </Alert>
        )}
        {state.status === "conflict" && (
          <Alert variant="destructive">
            <AlertTitle>This form has already saved an RSVP.</AlertTitle>
            <AlertDescription>
              <p>Use its private link to change your response.</p>
              <Link href={`/rsvp/edit?token=${submissionToken}`} referrerPolicy="no-referrer" className="underline underline-offset-4">Edit saved RSVP</Link>
            </AlertDescription>
          </Alert>
        )}
        {warning && (
          <Alert aria-labelledby="rsvp-duplicate-title">
            <AlertTitle id="rsvp-duplicate-title" tabIndex={-1}>
              {warning.matches.some(({ kind }) => kind === "exact")
                ? "This soup has already been registered."
                : "A similar soup has already been registered."}
            </AlertTitle>
            <AlertDescription className="space-y-3 [overflow-wrap:anywhere]">
              <ul className="space-y-1">
                {warning.matches.map((match, index) => (
                  <li key={index}>
                    <span className="text-foreground">{match.name}</span>
                    {" — brought by "}{match.contributorName}
                  </li>
                ))}
              </ul>
              <p>Choose a different soup, or register your version anyway.</p>
            </AlertDescription>
            <input
              type="hidden"
              name="acknowledgedSoupName"
              value={warning.soupName}
            />
          </Alert>
        )}
        <div className="flex flex-wrap gap-3">
          {warning && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => {
                form.current
                  ?.querySelector<HTMLInputElement>("#rsvp-soup-name")
                  ?.focus()
              }}
            >
              Choose another soup
            </Button>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending
              ? "Saving"
              : warning
                ? "Register this soup anyway"
                : editing ? "Save changes" : "RSVP"}
          </Button>
        </div>
        {editing && <div className="flex flex-col gap-3 border-t pt-7">
          {confirmCancel ? <>
            <p className="font-medium">Cancel your RSVP?</p>
            <p className="text-sm text-muted-foreground">You’ll be removed from the attending list and your soup will be released. You can return using this link.</p>
            <div className="flex flex-wrap gap-3">
              <Button id="rsvp-confirm-cancel" type="button" variant="destructive" disabled={pending} onClick={() => {
                const data = new FormData()
                data.set("editToken", editToken!)
                data.set("confirmCancel", "yes")
                React.startTransition(() => formAction(data))
              }}>{pending ? "Saving" : "Yes, cancel RSVP"}</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmCancel(false)}>Keep RSVP</Button>
            </div>
          </> : <Button type="button" variant="outline" disabled={pending} className="self-start" onClick={() => setConfirmCancel(true)}>Cancel RSVP</Button>}
        </div>}
      </FieldGroup>
    </form>
  )
}

export { RsvpForm }
