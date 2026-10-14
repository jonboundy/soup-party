"use client"

import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RecipePhotoField } from "@/components/recipe-photos"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { RecipePhotoDraft } from "@/lib/recipe-photo"
import type { GuestSoup, RecipeKind, RsvpErrors, RsvpField } from "@/lib/rsvp-form"

/**
 * The recipe as the form holds it. Only the chosen kind is sent, but what was
 * typed for another is kept, in case the guest changes their mind back.
 */
type RecipeDraft = { kind: RecipeKind; url: string; text: string }

/** The draft a form starts with: the saved recipe, which is one kind. */
function recipeDraft(soup: GuestSoup | null | undefined, photos: boolean): RecipeDraft {
  const url = soup?.recipeUrl ?? ""
  const text = soup?.recipeText ?? ""
  return { kind: text ? "text" : photos ? "photos" : url ? "link" : "none", url, text }
}

const kinds: { kind: RecipeKind; label: string; description: string }[] = [
  { kind: "none", label: "None", description: "Optional. Useful to anyone with allergies, or anyone who wants to make it again." },
  { kind: "link", label: "Link", description: "The address of the recipe. The soup list will link to it." },
  { kind: "text", label: "Text", description: "The recipe, written out. Anyone can read it from the soup list." },
  { kind: "photos", label: "Photos", description: "Anyone can see them from the soup list." },
]

/**
 * A soup's optional recipe: a link, the recipe written out, or photos of it.
 * It is one of them, chosen from a row, and only that one's field is shown.
 * The guest's form and the host's share it; `id` keeps their fields apart.
 *
 * Neither field has a `maxLength`, which would cut a pasted recipe short
 * without saying so. The action reports one that is too long.
 */
function RecipeFields({
  id,
  saved,
  value,
  onChange,
  photos,
  setPhotos,
  disabled,
  errors,
  onCorrect,
}: {
  id: string
  /** What the saved recipe is, which saving as another kind removes. */
  saved: RecipeKind
  value: RecipeDraft
  onChange: (value: RecipeDraft) => void
  photos: RecipePhotoDraft
  setPhotos: React.Dispatch<React.SetStateAction<RecipePhotoDraft>>
  /** While the form is being saved. */
  disabled: boolean
  errors: RsvpErrors
  onCorrect: (field: RsvpField) => void
}) {
  const fields = React.useRef<HTMLFieldSetElement>(null)
  // A kind chosen with a tap or a click takes focus to its field. Chosen with
  // the arrow keys, focus stays in the row, which they are still moving along.
  const pointer = React.useRef(false)
  const chosen = React.useRef(false)

  React.useEffect(() => {
    if (chosen.current) {
      chosen.current = false
      fields.current?.querySelector<HTMLElement>("input[type=url], textarea")?.focus()
    }
  }, [value.kind])

  const lost =
    saved === value.kind
      ? null
      : saved === "link"
        ? "the link"
        : saved === "text"
          ? "the written recipe"
          : saved === "photos" && photos.saved.length === 1
            ? "the photo"
            : saved === "photos" && photos.saved.length > 1
              ? `the ${photos.saved.length} photos`
              : null
  // An error in a field belongs to its kind, and leaves the form with it.
  const error =
    errors.recipeKind ||
    (value.kind === "link" ? errors.recipeUrl : value.kind === "text" ? errors.recipeText : undefined)

  return (
    <FieldSet ref={fields}>
      <FieldLegend id={`${id}-recipe-legend`} variant="label">
        Recipe
      </FieldLegend>
      <RadioGroup
        name="recipeKind"
        value={value.kind}
        onValueChange={(kind: RecipeKind) => {
          chosen.current = pointer.current
          onChange({ ...value, kind })
          onCorrect("recipeKind")
        }}
        onPointerDown={() => {
          pointer.current = true
        }}
        onKeyDown={() => {
          pointer.current = false
        }}
        disabled={disabled}
        aria-labelledby={`${id}-recipe-legend`}
        className="grid-cols-4 gap-1 rounded-lg border border-input bg-card p-1"
      >
        {kinds.map(({ kind, label }) => (
          <RadioPrimitive.Root
            key={kind}
            value={kind}
            className="flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors outline-none select-none not-data-checked:hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-checked:text-primary-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
          >
            {label}
          </RadioPrimitive.Root>
        ))}
      </RadioGroup>
      {value.kind === "link" && (
        <Field data-invalid={!!errors.recipeUrl}>
          <FieldLabel htmlFor={`${id}-recipe-url`} className="sr-only">
            Link to the recipe
          </FieldLabel>
          <Input
            id={`${id}-recipe-url`}
            name="recipeUrl"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value.url}
            onChange={(event) => {
              onChange({ ...value, url: event.target.value })
              onCorrect("recipeUrl")
            }}
            aria-invalid={!!errors.recipeUrl}
            aria-describedby={`${id}-recipe-description`}
          />
        </Field>
      )}
      {value.kind === "text" && (
        <Field data-invalid={!!errors.recipeText}>
          <FieldLabel htmlFor={`${id}-recipe-text`} className="sr-only">
            The recipe, written out
          </FieldLabel>
          <Textarea
            id={`${id}-recipe-text`}
            name="recipeText"
            autoComplete="off"
            // Grows with the recipe, then scrolls.
            className="max-h-80"
            value={value.text}
            onChange={(event) => {
              onChange({ ...value, text: event.target.value })
              onCorrect("recipeText")
            }}
            aria-invalid={!!errors.recipeText}
            aria-describedby={`${id}-recipe-description`}
          />
        </Field>
      )}
      {value.kind === "photos" && (
        <RecipePhotoField id={id} draft={photos} setDraft={setPhotos} disabled={disabled} />
      )}
      {error ? (
        <FieldError id={`${id}-recipe-description`}>{error}</FieldError>
      ) : (
        <FieldDescription id={`${id}-recipe-description`}>
          {kinds.find(({ kind }) => kind === value.kind)?.description}
        </FieldDescription>
      )}
      {/* A recipe is one kind of thing, so saving it as another loses the one it was. */}
      <p role="status" className="text-sm empty:hidden">
        {lost && `Saving removes ${lost}.`}
      </p>
    </FieldSet>
  )
}

export { RecipeFields, recipeDraft, type RecipeDraft }
