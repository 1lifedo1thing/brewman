// Links that leave the app, opened in the system browser (https only).
import { openUrl } from "nsh";

export const links = {
  website: "https://huacnlee.github.io/brewman/",
  repo: "https://github.com/huacnlee/brewman",
  issues: "https://github.com/huacnlee/brewman/issues",
  releases: "https://github.com/huacnlee/brewman/releases",
  sponsor: "https://github.com/sponsors/huacnlee",
  nsh: "https://nsh.dev",
} as const;

/** Opens `url` in the browser; a failure is logged, not thrown. */
export function openExternal(url: string): void {
  openUrl(url).catch(error => console.warn("brewman: couldn't open a link:", String(error)));
}
