import { route } from "@/lib/api";
import { listSections } from "@/services/admin/content";

export const GET = route({ auth: "staff", permission: "content.manage" }, async () => listSections());
