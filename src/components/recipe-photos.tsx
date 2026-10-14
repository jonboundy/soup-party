"use client"

import * as React from "react"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription } from "@/components/ui/field"
import {
  RECIPE_PHOTO_LIMIT,
  recipePhotoCount,
  type RecipePhotoDraft,
} from "@/lib/recipe-photo"
import { shrinkPhoto } from "@/lib/shrink-photo"

/**
 * Up to three photos of a recipe: a cookbook page, or a handwritten card.
 * Choosing a photo shrinks it in the browser and holds it in the draft; like
 * the fields beside it, nothing is sent until the form is saved.
 */
function RecipePhotoField({
  id,
  draft,
  setDraft,
  disabled,
}: {
  id: string
  draft: RecipePhotoDraft
  setDraft: React.Dispatch<React.SetStateAction<RecipePhotoDraft>>
  disabled: boolean
}) {
  const [notice, setNotice] = React.useState("")
  const count = recipePhotoCount(draft)
  const photos = [
    ...draft.saved
      .filter((photo) => !draft.removed.includes(photo.id))
      .map((photo) => ({ key: photo.id, src: photo.src, saved: true })),
    ...draft.added.map((photo) => ({ key: photo.preview, src: photo.preview, saved: false })),
  ]

  async function choose(files: File[]) {
    const room = RECIPE_PHOTO_LIMIT - count
    let unreadable = 0
    setNotice("")
    setDraft((current) => ({ ...current, preparing: true }))
    for (const file of files.slice(0, room)) {
      const blob = await shrinkPhoto(file)
      if (!blob) {
        unreadable++
        continue
      }
      const photo = { blob, preview: URL.createObjectURL(blob) }
      setDraft((current) => ({ ...current, added: [...current.added, photo] }))
    }
    setDraft((current) => ({ ...current, preparing: false }))
    setNotice(
      [
        unreadable === 1 && "One file could not be read as a photo.",
        unreadable > 1 && `${unreadable} files could not be read as photos.`,
        files.length > room && "A recipe has room for three photos. The rest were left out.",
      ]
        .filter(Boolean)
        .join(" ")
    )
  }

  function remove(photo: (typeof photos)[number]) {
    setNotice("")
    if (photo.saved) {
      setDraft((current) => ({ ...current, removed: [...current.removed, photo.key] }))
    } else {
      URL.revokeObjectURL(photo.key)
      setDraft((current) => ({
        ...current,
        added: current.added.filter(({ preview }) => preview !== photo.key),
      }))
    }
  }

  return (
    <Field aria-label="Photos of the recipe">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <li key={photo.key} className="flex flex-col gap-2">
              {photo.src ? (
                // A blob the browser holds, or a photo already the size it is
                // shown at: there is nothing for the image optimizer to do.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.src}
                  alt={`Photo ${index + 1}`}
                  className="aspect-3/4 w-full rounded-lg border bg-card object-cover"
                />
              ) : (
                // The soup is not listed, so its photos have no address to show them from.
                <div className="flex aspect-3/4 w-full items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
                  Photo {index + 1}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => remove(photo)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {count < RECIPE_PHOTO_LIMIT && (
        // A field stretches its children to its width. The button keeps its own.
        <div>
          {/*
            A label around the file input itself, so that the browser opens
            its own picker for a click, a tap or the keyboard. A button that
            clicked a hidden input from a script would depend on the browser
            agreeing that the script was the guest's doing.
          */}
          <label
            className={cn(
              buttonVariants({ variant: "outline" }),
              "cursor-pointer has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:pointer-events-none has-disabled:opacity-50"
            )}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={disabled || draft.preparing}
              aria-describedby={`${id}-recipe-photos-description`}
              onChange={(event) => {
                const files = [...(event.target.files ?? [])]
                // Cleared so that choosing the same file again is still a change.
                event.target.value = ""
                if (files.length) void choose(files)
              }}
            />
            {draft.preparing ? "Preparing" : count ? "Add another photo" : "Add photos"}
          </label>
        </div>
      )}
      <FieldDescription id={`${id}-recipe-photos-description`}>
        Up to three: a cookbook page, or a handwritten card.
      </FieldDescription>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {notice}
      </p>
    </Field>
  )
}

export { RecipePhotoField }
