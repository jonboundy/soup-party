"use client"

import * as React from "react"

import { submitRsvp } from "@/app/actions"
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
  formData: FormData
): Promise<RsvpFormState> {
  try {
    return await submitRsvp(previous, formData)
  } catch {
    return { status: "failed" }
  }
}

function Confirmation({
  state,
}: {
  state: Extract<RsvpFormState, { status: "attending" | "declined" }>
}) {
  const title = React.useRef<HTMLHeadingElement>(null)

  // The form, and whatever had focus in it, is gone. Focus moves here so
  // keyboard and screen reader users land on the outcome.
  React.useEffect(() => {
    title.current?.focus()
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <h3 ref={title} tabIndex={-1} className="type-heading outline-none">
        {state.status === "attending"
          ? "You’re on the list."
          : "Your regrets have been recorded."}
      </h3>
      <p className="type-lead text-muted-foreground">
        {state.status === "attending"
          ? `${state.name}, party of ${state.partySize}.`
          : `${state.name}, not attending.`}
      </p>
      {state.status === "attending" && (
        <p className="text-muted-foreground">
          {state.soup ? (
            <>
              Your soup has been registered:{" "}
              <span className="text-foreground">{state.soup}</span>
            </>
          ) : (
            "Soup to be decided."
          )}
        </p>
      )}
    </div>
  )
}

function RsvpForm() {
  const [state, formAction, pending] = React.useActionState<
    RsvpFormState,
    FormData
  >(submit, { status: "idle" })
  const [attendance, setAttendance] = React.useState("")
  const [partySize, setPartySize] = React.useState("1")
  const [soupName, setSoupName] = React.useState("")
  const [soupCategory, setSoupCategory] = React.useState<string | null>(null)
  // Fields changed since the last response. Their errors no longer apply.
  const [corrected, setCorrected] = React.useState<RsvpField[]>([])
  const form = React.useRef<HTMLFormElement>(null)

  // After a rejected submission, focus goes to the first field that needs
  // correcting, or back to the button when the response was not saved.
  React.useEffect(() => {
    if (state.status === "invalid") {
      form.current
        ?.querySelector<HTMLElement>("[aria-invalid=true]:not([type=hidden])")
        ?.focus()
    } else if (state.status === "failed") {
      form.current?.querySelector<HTMLElement>("[type=submit]")?.focus()
    }
  }, [state])

  if (state.status === "attending" || state.status === "declined") {
    return <Confirmation state={state} />
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
              As it should appear beside your soup.
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
                onChange={() => correct("soupDescription")}
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
        <Button type="submit" size="lg" disabled={pending} className="self-start">
          {pending ? "Sending" : "RSVP"}
        </Button>
      </FieldGroup>
    </form>
  )
}

export { RsvpForm }
