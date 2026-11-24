import "server-only";
import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
    "h2", "h3", "h4", "blockquote", "img", "figure", "figcaption", "hr", "code", "pre", "span",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true),
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }, true),
  },
  disallowedTagsMode: "discard",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Sanitize admin-authored rich text. Plain text (no tags) is converted to paragraphs.
 * Output is safe to render with dangerouslySetInnerHTML.
 */
export function sanitizeRichText(input: string | null | undefined): string {
  const value = (input ?? "").trim();
  if (!value) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  const html = looksLikeHtml
    ? value
    : value
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
        .join("");
  return sanitizeHtml(html, RICH_TEXT_OPTIONS);
}

/** Strip all markup — for plain-text fields like review bodies and contact messages. */
export function stripHtml(input: string | null | undefined): string {
  return sanitizeHtml(input ?? "", { allowedTags: [], allowedAttributes: {} }).trim();
}
