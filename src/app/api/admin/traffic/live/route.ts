import { route } from "@/lib/api";
import { getLiveVisitors } from "@/services/admin/traffic";

export const GET = route({ auth: "staff", permission: "dashboard.view" }, async () => getLiveVisitors());
