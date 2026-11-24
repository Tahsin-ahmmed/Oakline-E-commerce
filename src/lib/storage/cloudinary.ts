import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env, integrations } from "@/lib/env";
import { badRequest, AppError } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_FOLDERS = ["products", "categories", "banners", "blog", "brands", "branding", "collections"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** Detect the real image type from magic bytes — never trust the client-declared MIME type. */
export function sniffImageType(buf: Buffer): "jpeg" | "png" | "webp" | "avif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/.test(buf.toString("ascii", 8, 12))) return "avif";
  return null;
}

export function validateImage(buf: Buffer) {
  if (buf.length === 0) throw badRequest("The file is empty.");
  if (buf.length > MAX_UPLOAD_BYTES) throw badRequest("Images must be 5 MB or smaller.");
  const type = sniffImageType(buf);
  if (!type) throw badRequest("Only JPEG, PNG, WebP or AVIF images are allowed.");
  return type;
}

export async function uploadImage(buf: Buffer, folder: UploadFolder) {
  if (!integrations.cloudinary()) {
    throw new AppError(
      503,
      "UPLOADS_NOT_CONFIGURED",
      "Image uploads are not configured (set the CLOUDINARY_* variables). You can paste an image URL instead.",
    );
  }
  validateImage(buf);
  const e = env();
  cloudinary.config({
    cloud_name: e.CLOUDINARY_CLOUD_NAME,
    api_key: e.CLOUDINARY_API_KEY,
    api_secret: e.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${e.CLOUDINARY_UPLOAD_FOLDER}/${folder}`,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        transformation: [{ width: 2400, height: 2400, crop: "limit" }],
      },
      (error, res) => (error || !res ? reject(error ?? new Error("Upload failed")) : resolve(res)),
    );
    stream.end(buf);
  });
  return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height };
}
