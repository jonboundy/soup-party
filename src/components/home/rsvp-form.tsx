"use client"

import * as React from "react"
import Link from "next/link"

import {
  addRecipePhoto,
  cancelGuestRsvp,
  editRsvp,
  removeRecipePhoto,
  submitRsvp,
} from "@/app/actions"
import { RecipeFields, recipeDraft } from "@/components/recipe-fields"
import { RsvpConfirmation } from "@/components/rsvp-confirmation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  recipePhotoDraft,
  syncRecipePhotos,
  type RecipePhotoDraft,
  type RecipePhotoRef,
} from "@/lib/recipe-photo"
import { announceSoupGuests } from "@/lib/soup-guests"
import {
  NAME_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
  type RsvpErrors,
  type RsvpField,
  type RsvpFormState,
  type EditableRsvp,
} from "@/lib/rsvp-form"

// A request that never completes, because the guest is offline or the site
// was redeployed mid-visit, throws instead of returning. It is reported the
// same way as a response the server could not save.
async function submit(
  previous: RsvpFormState,
  formData: FormData,
  editing: boolean,
  photos: RecipePhotoDraft,
): Promise<RsvpFormState> {
  try {
    if (editing && formData.get("confirmCancel") === "yes") {
      return await cancelGuestRsvp(previous, formData)
    }
    const state = await (editing ? editRsvp : submitRsvp)(previous, formData)
    // Photos belong to a saved soup, so they are sent once there is one,
    // each in a request of its own. A new RSVP's token is by now its link.
    // A recipe of another kind has none: saving it removed any it had.
    if (state.status !== "attending" || !state.soup) return state
    if (formData.get("recipeKind") !== "photos") return state
    const editToken = formData.get(editing ? "editToken" : "submissionToken") as string
    const request = (field: string, value: string | Blob) => {
      const data = new FormData()
      data.set("editToken", editToken)
      data.set(field, value)
      return data
    }
    const sent = await syncRecipePhotos(photos, {
      add: (photo) => addRecipePhoto(request("photo", photo)),
      remove: (id) => removeRecipePhoto(request("photoId", id)),
    })
    return {
      ...state,
      photos: { saved: sent.saved.length, unsaved: sent.added.length + sent.removed.length },
    }
  } catch {
    return { status: "failed" }
  }
}

function RsvpForm({
  initial,
  savedPhotos = [],
  editToken,
  submissionToken,
}: {
  initial?: EditableRsvp
  /** The photos the saved recipe has, when editing. */
  savedPhotos?: RecipePhotoRef[]
  editToken?: string
  submissionToken?: string
}) {
  const editing = !!editToken
  // Chosen photos wait here, as the other answers wait in their fields.
  const [photos, setPhotos] = React.useState(() => recipePhotoDraft(savedPhotos))
  const [state, formAction, pending] = React.useActionState<
    RsvpFormState,
    FormData
  >((previous, data) => submit(previous, data, editing, photos), { status: "idle" })
  // A cancelled RSVP keeps its answers. Saving them again restores it.
  const cancelled = initial?.status === "DECLINED"
  const [soupName, setSoupName] = React.useState(initial?.soup?.name ?? "")
  const savedRecipe = recipeDraft(initial?.soup, savedPhotos.length > 0)
  // Held here, not in the fields: they leave the form while the soup has no
  // name, and what was typed in them should be there when they return.
  const [recipe, setRecipe] = React.useState(savedRecipe)
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

  // The bowl of soup above this form spells the names of whoever has just
  // responded. The edit page has no bowl.
  React.useEffect(() => {
    if (state.status === "attending" && !editing) {
      announceSoupGuests([state.name, state.secondName])
    }
  }, [state, editing])

  if (state.status === "attending" || state.status === "cancelled") {
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
        {cancelled && (
          <Alert>
            <AlertTitle>This RSVP is cancelled.</AlertTitle>
            <AlertDescription>Save it to return to the list.</AlertDescription>
          </Alert>
        )}
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
              Only first names appear beside your soup.
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={!!errors.secondName}>
          <FieldLabel htmlFor="rsvp-second-name">Second guest</FieldLabel>
          <Input
            id="rsvp-second-name"
            name="secondName"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={NAME_MAX_LENGTH}
            defaultValue={initial?.secondName ?? undefined}
            onChange={() => correct("secondName")}
            aria-invalid={!!errors.secondName}
            aria-describedby={
              errors.secondName
                ? "rsvp-second-name-error"
                : "rsvp-second-name-description"
            }
          />
          {errors.secondName ? (
            <FieldError id="rsvp-second-name-error">
              {errors.secondName}
            </FieldError>
          ) : (
            <FieldDescription id="rsvp-second-name-description">
              Optional. Leave blank if it is just you.
            </FieldDescription>
          )}
        </Field>
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
              {savedRecipe.kind !== "none"
                ? "Leaving this blank removes the soup and its recipe."
                : "Leave blank to decide later."}
            </FieldDescription>
          )}
        </Field>
        {soupName.trim() !== "" && (
          <RecipeFields
            id="rsvp"
            saved={savedRecipe.kind}
            value={recipe}
            onChange={setRecipe}
            photos={photos}
            setPhotos={setPhotos}
            disabled={pending}
            errors={errors}
            onCorrect={correct}
          />
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
          <Button type="submit" size="lg" disabled={pending || photos.preparing}>
            {pending
              ? "Saving"
              : warning
                ? "Register this soup anyway"
                : editing && !cancelled ? "Save changes" : "RSVP"}
          </Button>
        </div>
        {editing && !cancelled && <div className="flex flex-col gap-3 border-t pt-7">
          {confirmCancel ? <>
            <p className="font-medium">Cancel your RSVP?</p>
            <p className="text-sm text-muted-foreground">You’ll be removed from the list and your soup will be released. You can return using this link.</p>
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
