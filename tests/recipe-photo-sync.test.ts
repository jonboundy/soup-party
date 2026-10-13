import { describe, expect, it } from "vitest";

import {
  recipePhotoCount,
  recipePhotoDraft,
  syncRecipePhotos,
  type RecipePhotoState,
} from "@/lib/recipe-photo";

const saved = [{ id: "a", src: "/a" }, { id: "b", src: "/b" }];
const pending = (name: string) => ({ blob: new Blob([name]), preview: `blob:${name}` });
const failed: RecipePhotoState = { status: "failed" };

describe("a draft of a recipe's photos", () => {
  it("starts as what is saved, with nothing to send", () => {
    expect(recipePhotoDraft(saved)).toEqual({ saved, removed: [], added: [], preparing: false });
    expect(recipePhotoCount(recipePhotoDraft(saved))).toBe(2);
    expect(recipePhotoCount(recipePhotoDraft())).toBe(0);
  });

  it("counts what the recipe will have once saved", () => {
    expect(recipePhotoCount({ saved, removed: ["a"], added: [pending("c"), pending("d")], preparing: false })).toBe(3);
  });

  it("sends nothing when nothing has changed", async () => {
    const send = { add: async () => failed, remove: async () => failed };
    expect(await syncRecipePhotos(recipePhotoDraft(saved), send)).toEqual(recipePhotoDraft(saved));
  });

  it("removes before it adds, one at a time, and reports what is saved", async () => {
    const calls: string[] = [];
    const sent = await syncRecipePhotos(
      { saved, removed: ["a"], added: [pending("c"), pending("d")], preparing: false },
      {
        remove: async (id) => { calls.push(`remove ${id}`); return { status: "removed" }; },
        add: async (blob) => {
          const name = await blob.text();
          calls.push(`add ${name}`);
          return { status: "saved", photo: { id: name, src: `/${name}` } };
        },
      },
    );

    expect(calls).toEqual(["remove a", "add c", "add d"]);
    expect(sent).toEqual({
      saved: [{ id: "b", src: "/b" }, { id: "c", src: "/c" }, { id: "d", src: "/d" }],
      removed: [], added: [], preparing: false,
    });
  });

  it("keeps whatever could not be sent, and carries on with the rest", async () => {
    const [c, d, e] = [pending("c"), pending("d"), pending("e")];
    const sent = await syncRecipePhotos(
      { saved, removed: ["a", "b"], added: [c, d, e], preparing: false },
      {
        remove: async (id) => (id === "a" ? failed : { status: "removed" }),
        add: async (blob) => {
          const name = await blob.text();
          if (name === "c") throw new Error("offline");
          if (name === "d") return { status: "full" };
          return { status: "saved", photo: { id: name, src: null } };
        },
      },
    );

    expect(sent).toEqual({
      saved: [{ id: "a", src: "/a" }, { id: "e", src: null }],
      removed: ["a"], added: [c, d], preparing: false,
    });
  });
});
