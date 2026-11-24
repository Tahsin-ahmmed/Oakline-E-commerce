import { route } from "@/lib/api";
import { activityQuerySchema } from "@/lib/validations/admin/system";
import { listActivity } from "@/services/admin/activity";

export const GET = route({ auth: "staff", permission: "logs.view" }, async ({ query }) => listActivity(query(activityQuerySchema)));
