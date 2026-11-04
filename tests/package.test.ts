import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

test("collection exposes existing extension entry points exactly once", () => {
  assert.equal(manifest.name, "tarextension");
  assert.ok(manifest.keywords.includes("pi-package"));
  const entries = manifest.pi.extensions;
  assert.ok(entries.length > 0);
  assert.equal(new Set(entries).size, entries.length);
  for (const entry of entries) {
    assert.ok(entry.startsWith("./tarextension-"), `Expected extension subdirectory: ${entry}`);
    assert.ok(existsSync(path.resolve(root, entry)), `Missing extension entry: ${entry}`);
  }
});

for (const directory of ["tarextension-pi-project-switcher", "tarextension-pi-start-menu"]) {
  test(`collection includes ${directory} declared by its subpackage`, () => {
    const child = JSON.parse(readFileSync(path.join(root, directory, "package.json"), "utf8"));
    for (const entry of child.pi.extensions) {
      const relative = `./${directory}/${entry.replace(/^\.\//, "")}`;
      assert.ok(manifest.pi.extensions.includes(relative), `Missing collection entry: ${relative}`);
    }
  });
}
