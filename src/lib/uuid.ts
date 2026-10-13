/**
 * Whether a value could be one of the database's ids. Anything else is not
 * one, and PostgreSQL would reject it as an error rather than find nothing.
 */
export function isUuid(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id);
}
