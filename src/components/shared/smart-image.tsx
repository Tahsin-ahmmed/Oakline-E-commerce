import Image, { type ImageProps } from "next/image";

const OPTIMIZED_HOSTS = new Set(["res.cloudinary.com", "images.unsplash.com"]);

function isOptimizable(src: ImageProps["src"]) {
  if (typeof src !== "string") return true;
  if (src.startsWith("/")) return true;
  try {
    return OPTIMIZED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/** next/image that falls back to unoptimized rendering for hosts not configured in next.config.ts. */
export function SmartImage(props: ImageProps) {
  return <Image {...props} unoptimized={props.unoptimized ?? !isOptimizable(props.src)} alt={props.alt} />;
}
