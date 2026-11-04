import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { updateResource } from "../lib/selection.ts";

const host = process.env.PI_TEST_AGENT_ROOT;
const entry = fileURLToPath(new URL("../extensions/start-menu.ts", import.meta.url));

async function fixture(run: (fixture: any) => Promise<void>) {
  const directory = mkdtempSync(path.join(tmpdir(), "pi-start-menu-test-"));
  const agentDir = path.join(directory, "agent");
  const cwd = path.join(directory, "project");
  mkdirSync(path.join(agentDir, "extensions"), { recursive: true });
  mkdirSync(path.join(agentDir, "skills", "synthetic"), { recursive: true });
  mkdirSync(path.join(cwd, ".pi", "extensions"), { recursive: true });
  writeFileSync(path.join(agentDir, "skills", "synthetic", "SKILL.md"), "---\nname: synthetic\ndescription: Synthetic test instructions\n---\nTest only.\n");
  writeFileSync(path.join(agentDir, "extensions", "synthetic.ts"), 'throw new Error("Discovery must not execute this module");\n');
  writeFileSync(path.join(cwd, ".pi", "extensions", "project-test.ts"), 'throw new Error("Discovery must not execute project code");\n');
  writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({ theme: "dark", extensions: [], defaultModel: "synthetic-model" }));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    const loader = await import(pathToFileURL(path.join(host!, "dist/core/extensions/loader.js")).href);
    const require = createRequire(path.join(host!, "package.json"));
    const { visibleWidth } = await import(pathToFileURL(require.resolve("@earendil-works/pi-tui")).href);
    const loaded = await loader.loadExtensions([entry], cwd);
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.extensions.length, 1);
    const extension = loaded.extensions[0];
    let active = ["read", "bash"];
    loaded.runtime.getAllTools = () => ["read", "bash", "edit"].map((name) => ({ name, description: name }));
    loaded.runtime.getActiveTools = () => active;
    loaded.runtime.setActiveTools = (names: string[]) => { active = names; };
    const notices: string[] = [];
    let reloads = 0;
    let dialogs = 0;
    let keys: string[] = [];
    const keyMap: Record<string, string> = { "tui.select.up": "up", "tui.select.down": "down", "tui.select.pageUp": "pageup", "tui.select.pageDown": "pagedown", "tui.select.cancel": "escape", "tui.select.confirm": "enter", "tui.input.tab": "tab" };
    const ctx = {
      cwd, mode: "tui", hasUI: true,
      isProjectTrusted: () => false,
      waitForIdle: async () => {},
      reload: async () => { reloads++; },
      ui: {
        notify: (message: string) => { notices.push(message); },
        confirm: async () => true,
        custom: async (factory: any) => new Promise((resolve) => {
          dialogs++;
          const component = factory({ terminal: { rows: 24 }, requestRender() {} }, { fg: (_color: string, value: string) => value }, { matches: (data: string, action: string) => keyMap[action] === data }, resolve);
          for (const width of [1, 10, 40, 120]) {
            const lines = component.render(width);
            assert.ok(lines.length <= 24);
            assert.ok(lines.every((line: string) => visibleWidth(line) <= width));
          }
          component.invalidate();
          for (const key of keys) component.handleInput(key);
        }),
      },
    };
    await run({ agentDir, cwd, extension, ctx, notices, loader, runtime: loaded.runtime, get active() { return active; }, get reloads() { return reloads; }, get dialogs() { return dialogs; }, setKeys: (next: string[]) => { keys = next; } });
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
}

test("real Pi loader: command persists selection, reloads, and respects declined project trust", { skip: !host }, async () => {
  await fixture(async (f) => {
    f.setKeys(["n", "tab", "n", "tab", "n", "s", "enter"]);
    await f.extension.commands.get("start-menu").handler("", f.ctx);
    assert.equal(f.reloads, 1, f.notices.join("\n"));
    assert.deepEqual(f.active, []);
    const settings = JSON.parse(readFileSync(path.join(f.agentDir, "settings.json"), "utf8"));
    assert.equal(settings.theme, "dark");
    assert.equal(settings.defaultModel, "synthetic-model");
    assert.ok(settings.skills.includes("-skills/synthetic/SKILL.md"));
    assert.ok(settings.extensions.includes("-extensions/synthetic.ts"));
    assert.equal(existsSync(path.join(f.cwd, ".pi", "settings.json")), false);
    const saved = JSON.parse(readFileSync(path.join(f.agentDir, "start-menu.json"), "utf8"));
    assert.equal(saved.autoOpen, false);
    assert.deepEqual(saved.tools, { bash: false, edit: false, read: false });
    assert.ok(!f.notices.some((message: string) => message.startsWith("Startmenü:")), f.notices.join("\n"));
  });
});

test("real Pi loader: Escape never saves, startup opens once, non-TUI has no menu", { skip: !host }, async () => {
  await fixture(async (f) => {
    f.setKeys(["n", "escape"]);
    const startup = f.extension.handlers.get("session_start")[0];
    await startup({ type: "session_start" }, f.ctx);
    await startup({ type: "session_start" }, f.ctx);
    assert.equal(f.dialogs, 1);
    assert.equal(f.reloads, 0);
    assert.equal(existsSync(path.join(f.agentDir, "start-menu.json")), false);
    assert.deepEqual(f.active, ["read", "bash"]);
    await startup({ type: "session_start" }, { ...f.ctx, mode: "json" });
    assert.equal(f.dialogs, 1);
    assert.deepEqual(JSON.parse(readFileSync(path.join(f.agentDir, "settings.json"), "utf8")).extensions, []);
  });
});

test("real Pi discovery: enabling one file in an empty package filter leaves siblings disabled", { skip: !host }, async () => {
  await fixture(async (f) => {
    const api = await import(pathToFileURL(path.join(host!, "dist/index.js")).href);
    const pkg = path.join(f.agentDir, "synthetic-package");
    mkdirSync(path.join(pkg, "extensions"), { recursive: true });
    writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "synthetic-test-package", pi: { extensions: ["extensions/alpha.ts", "extensions/beta.ts"] } }));
    for (const name of ["alpha", "beta"]) writeFileSync(path.join(pkg, "extensions", `${name}.ts`), 'throw new Error("Must not execute");');
    const settings = api.SettingsManager.create(f.cwd, f.agentDir, { projectTrusted: false });
    settings.setPackages([{ source: pkg, extensions: [], prompts: [], autoload: true }]);
    await settings.flush();
    const manager = new api.DefaultPackageManager({ cwd: f.cwd, agentDir: f.agentDir, settingsManager: settings });
    const initial = await manager.resolve(async () => "skip");
    const alpha = initial.extensions.find((resource: any) => resource.path.endsWith("alpha.ts"));
    assert.ok(alpha);
    assert.equal(alpha.enabled, false);
    const updated = updateResource(settings.getGlobalSettings(), "extensions", alpha, true, f.agentDir);
    settings.setPackages(updated.packages);
    await settings.flush();
    const after = await manager.resolve(async () => "skip");
    assert.equal(after.extensions.find((resource: any) => resource.path.endsWith("alpha.ts")).enabled, true);
    assert.equal(after.extensions.find((resource: any) => resource.path.endsWith("beta.ts")).enabled, false);
    assert.deepEqual(settings.getGlobalSettings().packages[0].prompts, []);
    assert.equal(settings.getGlobalSettings().packages[0].autoload, true);
  });
});

test("real Pi loader: trusted project resource filters are saved to project scope", { skip: !host }, async () => {
  await fixture(async (f) => {
    f.ctx.isProjectTrusted = () => true;
    f.setKeys(["tab", "n", "enter"]);
    await f.extension.commands.get("start-menu").handler("", f.ctx);
    assert.equal(f.reloads, 1, f.notices.join("\n"));
    const project = JSON.parse(readFileSync(path.join(f.cwd, ".pi", "settings.json"), "utf8"));
    assert.ok(project.extensions.includes("-extensions/project-test.ts"));
    const global = JSON.parse(readFileSync(path.join(f.agentDir, "settings.json"), "utf8"));
    assert.ok(!global.extensions.some((entry: string) => entry.includes("project-test")));
  });
});

test("real Pi loader: saved tool preferences restore in JSON mode and include late tools", { skip: !host }, async () => {
  await fixture(async (f) => {
    writeFileSync(path.join(f.agentDir, "start-menu.json"), JSON.stringify({ version: 1, autoOpen: false, tools: { read: false, bash: false, edit: true, late: false } }));
    const loaded = await f.loader.loadExtensions([entry], f.cwd);
    assert.deepEqual(loaded.errors, []);
    let active = ["read", "bash"];
    let all = ["read", "bash", "edit"];
    loaded.runtime.getActiveTools = () => active;
    loaded.runtime.setActiveTools = (names: string[]) => { active = names; };
    loaded.runtime.getAllTools = () => all.map((name) => ({ name, description: name }));
    await loaded.extensions[0].handlers.get("session_start")[0]({ type: "session_start" }, { ...f.ctx, mode: "json" });
    assert.deepEqual(active, ["edit"]);
    assert.equal(f.dialogs, 0);
    all.push("late"); active.push("late");
    await loaded.extensions[0].handlers.get("before_agent_start")[0]({}, f.ctx);
    assert.deepEqual(active, ["edit"]);
  });
});

test("real Pi loader: corrupt configuration is reported and never overwritten", { skip: !host }, async () => {
  await fixture(async (f) => {
    const corrupt = '{"version":999}';
    writeFileSync(path.join(f.agentDir, "start-menu.json"), corrupt);
    const loaded = await f.loader.loadExtensions([entry], f.cwd);
    assert.deepEqual(loaded.errors, []);
    await loaded.extensions[0].commands.get("start-menu").handler("", f.ctx);
    assert.equal(f.dialogs, 0);
    assert.equal(readFileSync(path.join(f.agentDir, "start-menu.json"), "utf8"), corrupt);
    assert.ok(f.notices.some((notice: string) => notice.includes("nicht überschrieben")));
  });
});
