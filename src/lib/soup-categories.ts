import type { SoupCategory } from "@/generated/prisma/client";

/**
 * Every soup category with the name guests see, in the order they are
 * offered. Safe to import in the browser: the database enum is used only as
 * a type.
 */
export const SOUP_CATEGORIES = [
  { value: "BROTH", label: "Broth" },
  { value: "CREAMY", label: "Creamy" },
  { value: "VEGETABLE", label: "Vegetable" },
  { value: "BEAN", label: "Bean" },
  { value: "NOODLE", label: "Noodle" },
  { value: "MEAT", label: "Meat" },
  { value: "SEAFOOD", label: "Seafood" },
  { value: "STEW", label: "Stew" },
  { value: "CHILLED", label: "Chilled" },
  { value: "OTHER", label: "Other" },
] as const satisfies readonly { value: SoupCategory; label: string }[];
