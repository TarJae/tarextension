import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DefaultPackageManager, getAgentDir, SettingsManager, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { Menu, type MenuAction, type MenuResult } from "../lib/menu.ts";
import { parseState, resourceChoice, selectedTools, updateResource, type Choice, type MenuState, type ResourceSettings } from "../lib/selection.ts";

const self = fileURLToPath(import.meta.url);
// Survives /reload without persisting process bookkeeping to disk.
const openedKey = Symbol.for("tarextension.pi-start-menu.opened");
const processState = globalThis as typeof globalThis & { [openedKey]?: Set<string> };

export default function startMenu(pi: ExtensionAPI) {
  const agentDir = getAgentDir();
  const stateFile = join(agentDir, "start-menu.json");
  let state: MenuState = { version: 1, autoOpen: true, tools: Object.create(null) };
  let stateError: unknown;
  let opening = false;
  try { state = parseState(readFileSync(stateFile, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") stateError = error; }

  function applyTools() {
    if (!stateError) pi.setActiveTools(selectedTools(pi.getActiveTools(), state.tools, pi.getAllTools().filter((tool) => tool.exposure !== "hidden").map((tool) => tool.name)));
  }

  async function open(ctx: ExtensionContext): Promise<boolean> {
    if (ctx.mode !== "tui") { ctx.ui.notify("/start-menu benötigt den interaktiven TUI-Modus.", "error"); return false; }
    if (opening) return false;
    if (stateError) { ctx.ui.notify("start-menu.json ist ungültig oder nicht lesbar. Datei prüfen; sie wird nicht überschrieben.", "error"); return false; }
    opening = true;
    try {
      const settings = SettingsManager.create(ctx.cwd, agentDir, { projectTrusted: ctx.isProjectTrusted() });
      const loadErrors = settings.drainErrors();
      if (loadErrors.length) throw new Error("Pi-Einstellungen nicht lesbar; keine Änderungen vorgenommen.");
      const manager = new DefaultPackageManager({ cwd: ctx.cwd, agentDir, settingsManager: settings, builtinExtensions: ["mcp", "llama.cpp", "codemode", "tool-search"] });
      // Discovery only: never install packages or execute extension factories here.
      const resolved = await manager.resolve(async () => "skip");
      const active = new Set(pi.getActiveTools());
      const choices: Choice[] = [
        ...resolved.skills.map((resource) => resourceChoice("skills", resource, self)),
        ...resolved.extensions.map((resource) => resourceChoice("extensions", resource, self)),
        ...pi.getAllTools().filter((tool) => tool.exposure !== "hidden").map((tool) => ({ id: tool.name, category: "tools" as const, label: tool.name, enabled: active.has(tool.name), original: active.has(tool.name) })),
      ];
      choices.sort((a, b) => a.label.localeCompare(b.label));
      const result = await ctx.ui.custom<MenuResult | undefined>((tui, theme, kb, done) => {
        const menu = new Menu(choices, state.autoOpen);
        return {
          render(width: number) {
            const lines = menu.render(width, tui.terminal.rows, truncateToWidth);
            lines[0] = theme.fg("accent", lines[0]);
            return lines;
          },
          invalidate() {},
          handleInput(data: string) {
            let action: MenuAction | undefined;
            if (kb.matches(data, "tui.select.up")) action = "up";
            else if (kb.matches(data, "tui.select.down")) action = "down";
            else if (kb.matches(data, "tui.select.pageUp")) action = "pageUp";
            else if (kb.matches(data, "tui.select.pageDown")) action = "pageDown";
            else if (kb.matches(data, "tui.select.cancel") || matchesKey(data, "ctrl+c")) action = "cancel";
            else if (kb.matches(data, "tui.select.confirm")) action = "apply";
            else if (matchesKey(data, "shift+tab")) action = "previous";
            else if (kb.matches(data, "tui.input.tab")) action = "next";
            else if (data === " ") action = "toggle";
            else if (data === "a") action = "all";
            else if (data === "n") action = "none";
            else if (data === "s") action = "auto";
            if (!action) return;
            const outcome = menu.act(action);
            if (outcome === "cancel") done(undefined);
            else if (outcome) done(outcome);
            else tui.requestRender();
          },
        };
      });
      if (!result) return false;
      // Re-read before saving, so unrelated edits made while the menu was open survive.
      await settings.reload();
      if (settings.drainErrors().length) throw new Error("Pi-Einstellungen wurden geändert und sind nicht lesbar.");
      let global: ResourceSettings = settings.getGlobalSettings();
      let project: ResourceSettings = settings.getProjectSettings();
      const changed = result.choices.filter((choice) => choice.category !== "tools" && !choice.locked && choice.enabled !== choice.original);
      for (const choice of changed) {
        const resource = choice.resource!;
        const isProject = resource.metadata.scope === "project";
        const base = resource.metadata.baseDir ?? (isProject ? join(ctx.cwd, ".pi") : agentDir);
        if (isProject) project = updateResource(project, choice.category as "skills" | "extensions", resource, choice.enabled, base);
        else global = updateResource(global, choice.category as "skills" | "extensions", resource, choice.enabled, base);
      }
      // Only write touched fields through Pi's locking/merging SettingsManager.
      for (const scope of ["user", "project"] as const) {
        const touched = changed.filter((choice) => choice.resource!.metadata.scope === scope);
        const updated = scope === "user" ? global : project;
        if (touched.some((choice) => choice.resource!.metadata.origin === "package")) {
          if (scope === "user") settings.setPackages(updated.packages as Parameters<typeof settings.setPackages>[0]);
          else settings.setProjectPackages(updated.packages as Parameters<typeof settings.setProjectPackages>[0]);
        }
        for (const category of ["skills", "extensions"] as const) {
          if (!touched.some((choice) => choice.category === category && choice.resource!.metadata.origin === "top-level")) continue;
          const entries = updated[category] ?? [];
          if (scope === "user") {
            if (category === "skills") settings.setSkillPaths(entries); else settings.setExtensionPaths(entries);
          } else {
            if (category === "skills") settings.setProjectSkillPaths(entries); else settings.setProjectExtensionPaths(entries);
          }
        }
      }
      await settings.flush();
      if (settings.drainErrors().length) throw new Error("Pi-Einstellungen konnten nicht vollständig gespeichert werden. Einstellungen prüfen.");
      const tools = { ...state.tools };
      for (const choice of result.choices.filter((choice) => choice.category === "tools")) tools[choice.id] = choice.enabled;
      const next: MenuState = { version: 1, autoOpen: result.autoOpen, tools };
      mkdirSync(agentDir, { recursive: true });
      const temporary = `${stateFile}.${randomUUID()}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      renameSync(temporary, stateFile);
      state = next;
      applyTools();
      ctx.ui.notify(changed.length ? "Auswahl gespeichert. Skills/Extensions benötigen Reload; Tools sind aktiv." : "Auswahl gespeichert; Tools übernommen.", "info");
      return changed.length > 0;
    } catch (error) {
      ctx.ui.notify(`Startmenü: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`, "error");
      return false;
    } finally { opening = false; }
  }

  const menuCommand: Parameters<ExtensionAPI["registerCommand"]>[1] = {
    description: "Checkboxen für Skills, Extensions und Tools öffnen",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();
      const needsReload = await open(ctx);
      if (needsReload && await ctx.ui.confirm("Auswahl anwenden?", "Skills und Extensions jetzt neu laden? Bei Nein gilt die Auswahl nach /reload oder Neustart.")) {
        await ctx.reload();
        return; // Never reuse the old extension context after reload.
      }
    },
  };
  pi.registerCommand("tarextension-pi-start-menu", menuCommand);
  pi.registerCommand("start-menu", menuCommand);
  pi.on("session_start", async (_event, ctx) => {
    applyTools();
    if (ctx.mode !== "tui") return;
    if (stateError) { ctx.ui.notify("Startmenü-Konfiguration nicht lesbar; /start-menu zeigt Hinweise.", "warning"); return; }
    const opened = processState[openedKey] ??= new Set<string>();
    const key = `${agentDir}\0${ctx.cwd}`;
    if (!state.autoOpen || opened.has(key)) return;
    opened.add(key);
    if (await open(ctx)) ctx.ui.notify("Bitte /reload ausführen, um die gewählten Skills/Extensions zu laden.", "warning");
  });
  // Includes tools registered late (e.g. MCP). This controls model selection, not tool permissions.
  pi.on("before_agent_start", async () => { applyTools(); });
}
