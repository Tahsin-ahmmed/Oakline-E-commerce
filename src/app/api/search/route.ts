import { z } from "zod";
import { route } from "@/lib/api";
import { searchSuggestions } from "@/services/catalog";

/** GET /api/search?q= — instant search suggestions for the header search box. */
export const GET = route({ auth: "none" }, async ({ query }) => {
  const { q } = query(z.object({ q: z.string().trim().max(100).default("") }));
  return searchSuggestions(q);
});
