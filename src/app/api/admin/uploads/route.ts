import { route } from "@/lib/api";
import { badRequest, forbidden } from "@/lib/errors";
import { hasAnyPermission } from "@/lib/permissions";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, uploadImage, type UploadFolder } from "@/lib/storage/cloudinary";
import { integrations } from "@/lib/env";

export const POST = route({ auth: "staff", rateLimit: RATE_LIMITS.upload, rateLimitBy: "user" }, async ({ req, user }) => {
  if (!hasAnyPermission(user, ["products.manage", "catalog.manage", "content.manage", "settings.manage"])) {
    throw forbidden();
  }
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 64 * 1024) throw badRequest("Images must be 5 MB or smaller.");
  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "products") as UploadFolder;
  if (!(file instanceof File)) throw badRequest("No file received.");
  if (!UPLOAD_FOLDERS.includes(folder)) throw badRequest("Invalid upload folder.");
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest("Images must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  return uploadImage(buf, folder);
});

export const GET = route({ auth: "staff" }, async () => ({ enabled: integrations.cloudinary(), maxBytes: MAX_UPLOAD_BYTES }));
