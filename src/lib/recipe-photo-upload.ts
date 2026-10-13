import "server-only";

import { cleanJpeg } from "@/lib/jpeg";
import { RECIPE_PHOTO_MAX_BYTES, RECIPE_PHOTO_MAX_EDGE } from "@/lib/recipe-photo";

/**
 * The one photo a request carries, ready to store, or null. The form shrinks
 * every photo to a small JPEG before sending it, but anyone can post
 * anything here, so the file is judged by its bytes: its name and declared
 * type are ignored, and only a JPEG within the limits is accepted, with its
 * metadata removed.
 */
export async function uploadedPhoto(formData: FormData) {
  const photos = formData.getAll("photo");
  const [photo] = photos;
  if (photos.length !== 1 || !(photo instanceof Blob)) return null;
  if (photo.size === 0 || photo.size > RECIPE_PHOTO_MAX_BYTES) return null;
  return cleanJpeg(new Uint8Array(await photo.arrayBuffer()), RECIPE_PHOTO_MAX_EDGE);
}
