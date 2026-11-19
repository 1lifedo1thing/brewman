import { t } from "nsh/i18n";
import { run } from "process";

export interface Package {
  id: string; name: string; kind: "Formula" | "Cask"; installed: string;
  latest: string; outdated: boolean; desc: string; tap: string; dependencies: string[];
}
interface Info {
  name: string; full_name: string; token: string; full_token: string;
  tap: string; desc: string; outdated: boolean; version: string;
  dependencies?: string[]; depends_on?: {formula?: string[]; cask?: string[]};
  revision: number; versions: { stable: string }; installed: {version: string}[];
}
let executable = "";
export async function brew(args: string[]) {
  if (!executable) {
    for (const path of ["brew", "/opt/homebrew/bin/brew", "/usr/local/bin/brew"]) {
      try {
        if ((await run(path, ["--version"])).code === 0) { executable = path; break; }
      } catch { continue; }
    }
    if (!executable) throw new Error(t("errors.no_brew"));
  }
  const result = await run(executable, args, {timeoutMs: 1800000});
  if (result.code !== 0) throw new Error((result.stderr || result.stdout || t("errors.brew_failed")).trim().slice(-1200));
  return result.stdout;
}
export async function inventory(): Promise<Package[]> {
  const info = JSON.parse(await brew(["info", "--json=v2", "--installed"]));
  const formulae = info.formulae.map((f: Info): Package => ({
    id: f.full_name, name: f.name, kind: "Formula", desc: f.desc, tap: f.tap, dependencies: f.dependencies || [],
    installed: f.installed.map(x => x.version).join(", "), outdated: f.outdated,
    latest: f.versions.stable + (f.revision ? "_" + f.revision : "")
  }));
  const casks = info.casks.map((c: Info & {installed: string | string[]}): Package => ({
    id: c.full_token || c.token, name: c.token, kind: "Cask", desc: c.desc, tap: c.tap, dependencies: [...(c.depends_on?.formula || []), ...(c.depends_on?.cask || [])],
    installed: String(c.installed), latest: c.version, outdated: c.outdated
  }));
  return [...formulae, ...casks].sort((a,b) => a.name.localeCompare(b.name));
}
export function modify(action: "upgrade" | "uninstall", item: Package) {
  return brew([action, item.kind === "Formula" ? "--formula" : "--cask", item.id]);
}
