/** Helpers for reading admin list-page search params (server components). */

export type SearchParams = Record<string, string | string[] | undefined>;

export function str(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim().slice(0, 200) : undefined;
}

export function oneOf<T extends string>(sp: SearchParams, key: string, values: readonly T[]): T | undefined {
  const v = str(sp, key);
  return v && (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function pageParams(sp: SearchParams, defaultSize = 20) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(str(sp, "page") ?? "1", 10) || 1));
  const pageSize = Math.max(5, Math.min(100, Number.parseInt(str(sp, "pageSize") ?? String(defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function dateParam(sp: SearchParams, key: string): Date | undefined {
  const v = str(sp, key);
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
