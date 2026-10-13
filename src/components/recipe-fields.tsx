"use client"

import * as React from "react"

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
import { Textarea } from "@/components/ui/textarea"
import type { RecipePhotoDraft } from "@/lib/recipe-photo"
import type { RsvpErrors, RsvpField } from "@/lib/rsvp-form"

/** What has been typed into the recipe fields, which may both be blank. */
type RecipeDraft = { url: string; text: string }

/**
 * A soup's optional recipe: a link, the recipe written out, photos of it, or
 * any of them together. The guest's form and the host's share it; `id` keeps
 * their fields apart.
 *
 * Neither field has a `maxLength`, which would cut a pasted recipe short
 * without saying so. The action reports one that is too long.
 */
function RecipeFields({
  id,
  description,
  value,
  onChange,
  photos,
  setPhotos,
  disabled,
  errors,
  onCorrect,
}: {
  id: string
  description: string
  value: RecipeDraft
  onChange: (value: RecipeDraft) => void
  photos: RecipePhotoDraft
  setPhotos: React.Dispatch<React.SetStateAction<RecipePhotoDraft>>
  /** While the form is being saved. */
  disabled: boolean
  errors: RsvpErrors
  onCorrect: (field: RsvpField) => void
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Recipe</FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      <Field data-invalid={!!errors.recipeUrl}>
        <FieldLabel htmlFor={`${id}-recipe-url`}>Link</FieldLabel>
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
          aria-describedby={errors.recipeUrl ? `${id}-recipe-url-error` : undefined}
        />
        {errors.recipeUrl && (
          <FieldError id={`${id}-recipe-url-error`}>{errors.recipeUrl}</FieldError>
        )}
      </Field>
      <Field data-invalid={!!errors.recipeText}>
        <FieldLabel htmlFor={`${id}-recipe-text`}>Text</FieldLabel>
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
          aria-describedby={errors.recipeText ? `${id}-recipe-text-error` : undefined}
        />
        {errors.recipeText && (
          <FieldError id={`${id}-recipe-text-error`}>{errors.recipeText}</FieldError>
        )}
      </Field>
      <RecipePhotoField id={id} draft={photos} setDraft={setPhotos} disabled={disabled} />
    </FieldSet>
  )
}

export { RecipeFields, type RecipeDraft }
