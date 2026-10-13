/**
 * One photo of a soup's recipe. Public while the soup is: anything else at
 * this address, including a declined guest's photo, is not found.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/soups/[id]/photos/[photoId]">,
) {
  const { id, photoId } = await params;
  let bytes = null;
  // Previews have no database, and so no photos.
  if (process.env.DATABASE_URL) {
    try {
      const { readPublicRecipePhoto } = await import("@/lib/recipe-photos");
      bytes = await readPublicRecipePhoto(id, photoId);
    } catch (error) {
      console.error("Recipe photo could not be loaded:", error instanceof Error ? error.name : typeof error);
      return new Response(null, { status: 503 });
    }
  }
  if (!bytes) return new Response(null, { status: 404 });

  return new Response(bytes, {
    headers: {
      // Stored only after being checked as a JPEG, and never served as anything else.
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      // A photo never changes, but it can be removed or its soup withdrawn:
      // a browser may keep it for a day, and a shared cache not at all.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
