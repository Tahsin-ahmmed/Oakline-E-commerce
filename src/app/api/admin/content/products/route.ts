import { z } from "zod";
import { route } from "@/lib/api";
import { searchProductsForPicker } from "@/services/admin/content";

/** GET ?q= — product search for the collection product picker. */
export const GET = route({ auth: "staff", permission: "content.manage" }, async ({ query }) => {
  const { q } = query(z.object({ q: z.string().trim().max(80).default("") }));
  return searchProductsForPicker(q);
});
