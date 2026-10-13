// What the recipe photo control and its server actions share. Safe to import
// in the browser.

/** Photos a soup's recipe may have. The database holds a soup to this too. */
export const RECIPE_PHOTO_LIMIT = 3;
/** The longer side of a stored photo, in pixels. Enough to read a cookbook page. */
export const RECIPE_PHOTO_MAX_EDGE = 1600;
/** One photo travels in one request, which Next.js limits to 1 MB by default. */
export const RECIPE_PHOTO_MAX_BYTES = 600_000;

/**
 * A stored photo. `src` is its public address, or null while the soup is not
 * listed and so has no public address to show it from.
 */
export type RecipePhotoRef = { id: string; src: string | null };

/** The result of sending or removing one photo. */
export type RecipePhotoState =
  | { status: "saved"; photo: RecipePhotoRef }
  | { status: "removed" }
  /** Not a JPEG the site accepts: the browser shrinks every photo to one before sending it. */
  | { status: "invalid" }
  /** The soup already has every photo it may. */
  | { status: "full" }
  /** The response has no soup for the photo to belong to. */
  | { status: "no-soup" }
  | { status: "unauthorized" }
  | { status: "rate-limited" }
  /** Not saved. Sending it again may work. */
  | { status: "failed" };

/**
 * A photo chosen in the form and shrunk, waiting for the form to be saved.
 * `preview` is an object URL for the blob, and is what tells two apart.
 */
export type PendingPhoto = { blob: Blob; preview: string };

/**
 * The photos as the form shows them. Like the form's other fields, nothing
 * here is sent until the form is saved.
 */
export type RecipePhotoDraft = {
  saved: RecipePhotoRef[];
  /** Ids of saved photos to remove. */
  removed: string[];
  added: PendingPhoto[];
  /** Chosen files are still being shrunk, so the form is not ready to send. */
  preparing: boolean;
};

export function recipePhotoDraft(saved: RecipePhotoRef[] = []): RecipePhotoDraft {
  return { saved, removed: [], added: [], preparing: false };
}

/** How many photos the recipe will have once the draft is saved. */
export function recipePhotoCount({ saved, removed, added }: RecipePhotoDraft) {
  return saved.length - removed.length + added.length;
}

/**
 * Sends a draft's changes, one photo to a request, removals first so that
 * their places are free. A request that fails or throws leaves its photo in
 * the returned draft, to be reported and tried again; the rest carry on.
 */
export async function syncRecipePhotos(
  draft: RecipePhotoDraft,
  send: {
    add: (photo: Blob) => Promise<RecipePhotoState>;
    remove: (id: string) => Promise<RecipePhotoState>;
  },
): Promise<RecipePhotoDraft> {
  let saved = draft.saved;
  const removed: string[] = [];
  const added: PendingPhoto[] = [];

  for (const id of draft.removed) {
    const result = await send.remove(id).catch(() => null);
    if (result?.status === "removed") saved = saved.filter((photo) => photo.id !== id);
    else removed.push(id);
  }
  for (const photo of draft.added) {
    const result = await send.add(photo.blob).catch(() => null);
    if (result?.status === "saved") saved = [...saved, result.photo];
    else added.push(photo);
  }
  return { saved, removed, added, preparing: false };
}
