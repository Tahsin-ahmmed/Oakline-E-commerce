import { route } from "@/lib/api";
import { getCategoryTree } from "@/services/catalog";

export const GET = route({ auth: "none" }, async () => getCategoryTree());
