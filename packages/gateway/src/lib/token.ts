import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison; hashing first makes the lengths equal. */
export function tokenMatches(provided: string | null, expected: string): boolean {
  if (provided === null) return false;
  const digest = (value: string) =>
    new Uint8Array(createHash("sha256").update(value).digest());
  return timingSafeEqual(digest(provided), digest(expected));
}

/** The `token` query parameter of a WebSocket upgrade request. */
export function tokenFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  return new URL(url, "http://gateway").searchParams.get("token");
}
