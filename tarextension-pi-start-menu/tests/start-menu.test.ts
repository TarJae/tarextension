import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Menu } from "../lib/menu.ts";
import { parseState, resourceChoice, selectedTools, setExact, updateResource, type Choice, type Resource } from "../lib/selection.ts";

const root = path.resolve("synthetic-profile");
const resource: Resource = { path: path.join(root, "extensions", "sample.ts"), enabled: true, metadata: { scope: "user", origin: "top-level", source: "auto", baseDir: root } };
const choice = (category: Choice["category"], enabled = true, locked = false): Choice => ({ id: category, label: category, category, enabled, original: enabled, locked });

test("exact overrides are idempotent and preserve unrelated rules", () => {
  assert.deepEqual(setExact(["!other/**", "-a", "+a"], "a", false), ["!other/**", "-a"]);
  assert.deepEqual(setExact(setExact([], "a", false), "a", true), ["+a"]);
});
test("top-level resource updates preserve settings and original objects", () => {
  const original = { extensions: ["!legacy/**"], theme: "dark", defaultModel: "synthetic-model" };
  const result = updateResource(original, "extensions", resource, false, root);
  assert.deepEqual(result.extensions, ["!legacy/**", "-extensions/sample.ts"]);
  assert.equal(result.theme, "dark");
  assert.equal(result.defaultModel, "synthetic-model");
  assert.deepEqual(original.extensions, ["!legacy/**"]);
});
test("built-in names remain builtin identities", () => {
  assert.deepEqual(updateResource({}, "extensions", { ...resource, path: "builtin:mcp" }, false, root).extensions, ["-builtin:mcp"]);
});
test("package string turns into filter object without changing other packages", () => {
  const pkgResource: Resource = { ...resource, metadata: { ...resource.metadata, origin: "package", source: "./synthetic-package" } };
  const original = { packages: ["./synthetic-package", "./untouched"] };
  const result = updateResource(original, "extensions", pkgResource, false, root);
  assert.deepEqual(result.packages, [{ source: "./synthetic-package", extensions: ["-extensions/sample.ts"] }, "./untouched"]);
  assert.equal(typeof original.packages[0], "string");
});
test("empty package filter keeps all other files disabled when enabling one", () => {
  const pkgResource: Resource = { ...resource, metadata: { ...resource.metadata, origin: "package", source: "./synthetic-package" } };
  const original = { packages: [{ source: "./synthetic-package", extensions: [], skills: ["!*"], autoload: false }] };
  const result = updateResource(original, "extensions", pkgResource, true, root);
  assert.deepEqual(result.packages, [{ source: "./synthetic-package", extensions: ["!*", "!**/*", "+extensions/sample.ts"], skills: ["!*"], autoload: false }]);
  assert.deepEqual(original.packages[0].extensions, []);
});
test("missing packages and temporary resources fail before writing", () => {
  assert.throws(() => updateResource({}, "skills", { ...resource, metadata: { ...resource.metadata, origin: "package" } }, false, root));
  assert.throws(() => updateResource({}, "extensions", { ...resource, metadata: { ...resource.metadata, scope: "temporary" } }, false, root));
});
test("start-menu extension is protected from disabling itself", () => {
  assert.equal(resourceChoice("extensions", resource, resource.path).locked, true);
  const menu = new Menu([{ ...choice("extensions"), locked: true }], true);
  menu.act("next"); menu.act("none"); menu.act("toggle");
  assert.equal(menu.items[0].enabled, true);
});
test("checkbox edits are drafts and bulk actions apply only to current tab", () => {
  const original = [choice("skills"), choice("extensions"), choice("tools")];
  const menu = new Menu(original, true);
  menu.act("none");
  assert.equal(menu.choices[0].enabled, false);
  assert.equal(menu.choices[1].enabled, true);
  assert.equal(original[0].enabled, true);
  assert.equal(menu.act("cancel"), "cancel");
  menu.act("next"); menu.act("toggle"); menu.act("auto");
  assert.equal((menu.act("apply") as { autoOpen: boolean }).autoOpen, false);
});
test("empty lists, paging and resize do not crash or overflow", () => {
  const menu = new Menu([], true);
  for (const action of ["toggle", "down", "pageDown", "pageUp", "up"] as const) menu.act(action);
  for (const width of [1, 10, 40, 120]) {
    const lines = menu.render(width, 24, (text, columns) => text.slice(0, columns));
    assert.ok(lines.every((line) => line.length <= width));
    assert.ok(lines.length <= 24);
  }
  const many = new Menu(Array.from({ length: 200 }, (_, i) => ({ ...choice("skills"), id: String(i) })), true);
  for (let i = 0; i < 30; i++) many.act("pageDown");
  assert.equal(many.cursor, 199);
  assert.ok(many.render(80, 24, (text, columns) => text.slice(0, columns)).length <= 24);
});
test("saved tools restore known selections without enabling new tools implicitly", () => {
  assert.deepEqual(selectedTools(["read", "bash"], { bash: false, edit: true, absent: true }, ["read", "bash", "edit", "late"]), ["read", "edit"]);
  assert.deepEqual(selectedTools(["late"], { late: false }, ["late"]), []);
  assert.deepEqual(selectedTools([], {}, ["read"]), []);
});
test("configuration parser rejects corruption and unsupported schema versions", () => {
  assert.deepEqual({ ...parseState('{"version":1,"autoOpen":false,"tools":{"read":true}}').tools }, { read: true });
  for (const value of ["{", "null", '{"version":2}', '{"version":1,"autoOpen":true,"tools":[]}', '{"version":1,"autoOpen":true,"tools":{"read":"true"}}']) assert.throws(() => parseState(value));
  assert.equal(Object.getPrototypeOf(parseState('{"version":1,"autoOpen":true,"tools":{}}').tools), null);
});
