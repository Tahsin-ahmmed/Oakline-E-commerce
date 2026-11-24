import { z } from "zod";
import { route } from "@/lib/api";
import { previewContent } from "@/services/admin/blog";

/** POST { content } — returns the sanitized HTML exactly as it will be rendered on the storefront. */
export const POST = route({ auth: "staff", permission: "content.manage" }, async ({ json }) => {
  const { content } = await json(z.object({ content: z.string().max(100_000) }));
  return { html: previewContent(content) };
});
