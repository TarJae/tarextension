import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  defaultProjectsRoot,
  expandPath,
  projectChoices,
  resolveDirectory,
  sameDirectory,
  stripQuotes,
} from "../lib/paths.ts";

test("stripQuotes entfernt passende äußere Anführungszeichen", () => {
  assert.equal(stripQuotes('  "C:\\Mein Projekt"  '), "C:\\Mein Projekt");
  assert.equal(stripQuotes("'relativer ordner'"), "relativer ordner");
  assert.equal(stripQuotes("ohne-quotes"), "ohne-quotes");
});

test("expandPath unterstützt Home und Windows-Umgebungsvariablen", () => {
  const home = path.join(path.parse(process.cwd()).root, "Users", "Test");
  assert.equal(expandPath("~/Projekt", {}, home), path.join(home, "Projekt"));
  assert.equal(
    expandPath("%PROJECTS%\\Studie", { PROJECTS: "C:\\Projekte" }, home),
    "C:\\Projekte\\Studie",
  );
});

test("resolveDirectory löst relative Pfade gegen das aktive Projekt auf", () => {
  const cwd = path.join(path.parse(process.cwd()).root, "Projekte", "A");
  assert.equal(resolveDirectory("../B", cwd), path.resolve(cwd, "../B"));
});

test("defaultProjectsRoot verwendet unter Windows C:\\Projekte", () => {
  assert.equal(defaultProjectsRoot("win32", { SystemDrive: "C:" }, "C:\\Users\\Test"), "C:\\Projekte");
});

test("projectChoices findet direkte Unterordner und entfernt Duplikate", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "tarextension-projects-"));
  const projects = path.join(root, "Projekte");
  const currentParent = path.join(root, "Arbeitsbereiche");
  const cwd = path.join(currentParent, "Aktuell");
  mkdirSync(path.join(projects, "Alpha"), { recursive: true });
  mkdirSync(path.join(projects, "Beta"), { recursive: true });
  mkdirSync(cwd, { recursive: true });
  mkdirSync(path.join(currentParent, "Nachbar"), { recursive: true });

  try {
    assert.deepEqual(projectChoices(cwd, projects), [
      path.join(currentParent, "Aktuell"),
      path.join(currentParent, "Nachbar"),
      path.join(projects, "Alpha"),
      path.join(projects, "Beta"),
    ].sort((a, b) => a.localeCompare(b, "de")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sameDirectory vergleicht Windows-Pfade ohne Beachtung der Großschreibung", () => {
  assert.equal(sameDirectory("C:\\Projekte\\Test", "c:\\projekte\\test", "win32"), true);
});
