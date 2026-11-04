import path from "node:path";

export type Category = "skills" | "extensions" | "tools";
export interface Resource {
  path: string;
  enabled: boolean;
  metadata: {
    scope: "user" | "project" | "temporary";
    origin: "package" | "top-level";
    source: string;
    baseDir?: string;
  };
}
export interface Choice {
  id: string;
  category: Category;
  label: string;
  enabled: boolean;
  original: boolean;
  locked?: boolean;
  resource?: Resource;
}
export interface PackageEntry {
  source: string;
  extensions?: string[];
  skills?: string[];
}
export interface ResourceSettings {
  extensions?: string[];
  skills?: string[];
  packages?: (string | PackageEntry)[];
}

export function setExact(entries: string[], pattern: string, enabled: boolean): string[] {
  return [...entries.filter((entry) => entry.replace(/^[!+-]/, "") !== pattern), `${enabled ? "+" : "-"}${pattern}`];
}

/** Pure update: preserve unrelated fields, filters, package options and input objects. */
export function updateResource<T extends ResourceSettings>(settings: T, category: "skills" | "extensions", resource: Resource, enabled: boolean, baseDir: string): T & ResourceSettings {
  if (resource.metadata.scope === "temporary") throw new Error("Temporäre Ressourcen sind nicht speicherbar.");
  if (resource.metadata.origin === "top-level") {
    const pattern = resource.path.startsWith("builtin:") ? resource.path : path.relative(baseDir, resource.path).replaceAll("\\", "/");
    return { ...settings, [category]: setExact(settings[category] ?? [], pattern, enabled) };
  }
  const packages = [...(settings.packages ?? [])];
  const index = packages.findIndex((pkg) => (typeof pkg === "string" ? pkg : pkg.source) === resource.metadata.source);
  if (index < 0 || !resource.metadata.baseDir) throw new Error("Paketquelle nicht gefunden; Menü erneut öffnen.");
  const current = packages[index];
  const pkg = typeof current === "string" ? { source: current } : current;
  const pattern = path.relative(resource.metadata.baseDir, resource.path).replaceAll("\\", "/");
  // [] explicitly disables the entire category. Preserve that meaning when enabling one file.
  const entries = pkg[category];
  const filters = entries?.length === 0 ? ["!*", "!**/*"] : (entries ?? []);
  packages[index] = { ...pkg, [category]: setExact(filters, pattern, enabled) };
  return { ...settings, packages };
}

export function resourceChoice(category: "skills" | "extensions", resource: Resource, self: string): Choice {
  const filename = path.basename(resource.path);
  const label = filename === "SKILL.md" ? path.basename(path.dirname(resource.path)) : resource.path.startsWith("builtin:") ? resource.path : `${path.basename(path.dirname(resource.path))}/${filename}`;
  const locked = path.resolve(resource.path) === path.resolve(self) || resource.metadata.scope === "temporary";
  return {
    id: `${category}:${resource.path}`, category,
    label: `${label} · ${resource.metadata.scope} · ${resource.metadata.source}`,
    enabled: resource.enabled, original: resource.enabled, resource, locked,
  };
}

export function toggleAll(choices: Choice[], category: Category, enabled: boolean): void {
  for (const choice of choices) if (choice.category === category && !choice.locked) choice.enabled = enabled;
}

export function selectedTools(active: string[], preferences: Record<string, boolean>, available: string[]): string[] {
  const selection = new Set(active);
  for (const name of available) {
    if (!Object.hasOwn(preferences, name)) continue;
    if (preferences[name]) selection.add(name);
    else selection.delete(name);
  }
  return [...selection].filter((name) => available.includes(name));
}

export interface MenuState { version: 1; autoOpen: boolean; tools: Record<string, boolean> }
export function parseState(text: string): MenuState {
  const data = JSON.parse(text);
  if (data?.version !== 1 || typeof data.autoOpen !== "boolean" || !data.tools || Array.isArray(data.tools) || typeof data.tools !== "object" || Object.values(data.tools).some((value) => typeof value !== "boolean")) {
    throw new Error("Ungültige Startmenü-Konfiguration.");
  }
  return { version: 1, autoOpen: data.autoOpen, tools: Object.assign(Object.create(null), data.tools) };
}
