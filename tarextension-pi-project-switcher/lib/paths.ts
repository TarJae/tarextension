import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function expandPath(
  value: string,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  let expanded = stripQuotes(value);

  if (expanded === "~") {
    expanded = home;
  } else if (expanded.startsWith("~/") || expanded.startsWith("~\\")) {
    expanded = path.join(home, expanded.slice(2));
  }

  return expanded.replace(/%([^%]+)%/g, (match, name: string) => env[name] ?? match);
}

export function resolveDirectory(input: string, cwd: string): string {
  return path.resolve(cwd, expandPath(input));
}

export function defaultProjectsRoot(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === "win32") {
    return path.join(env.SystemDrive ?? "C:", "Projekte");
  }
  return path.join(home, "Projects");
}

export function projectChoices(cwd: string, projectsRoot = defaultProjectsRoot()): string[] {
  const roots = [projectsRoot, path.dirname(cwd)];
  const choices = new Set<string>();

  for (const root of roots) {
    if (!existsSync(root)) continue;
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) choices.add(path.join(root, entry.name));
      }
    } catch {
      // Unreadable directories are simply omitted from completion and selection.
    }
  }

  return [...choices].sort((a, b) => a.localeCompare(b, "de"));
}

export function sameDirectory(left: string, right: string, platform: NodeJS.Platform = process.platform): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return platform === "win32" ? a.toLocaleLowerCase("de") === b.toLocaleLowerCase("de") : a === b;
}
