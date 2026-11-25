import { z } from "zod";
import { route } from "@/lib/api";
import { recordPageView } from "@/services/analytics";

const schema = z.object({
  path: z.string().trim().min(1).max(500).startsWith("/"),
  search: z.string().max(1000).optional().default(""),
  referrer: z.string().max(1000).optional().nullable(),
});

/** POST /api/track — first-party page-view beacon from the storefront (same-origin only, rate limited). */
export const POST = route(
  { auth: "optional", rateLimit: { name: "track", limit: 300, windowSeconds: 600 } },
  async ({ json, user }) => {
    const input = await json(schema);
    return recordPageView(input, user);
  },
);
