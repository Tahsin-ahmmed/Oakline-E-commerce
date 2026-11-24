import { route } from "@/lib/api";
import { getCartCount } from "@/services/cart";

export const GET = route({ auth: "optional" }, async () => ({ count: await getCartCount() }));
