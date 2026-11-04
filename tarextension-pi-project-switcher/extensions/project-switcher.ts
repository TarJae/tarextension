import { existsSync, statSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { projectChoices, resolveDirectory, sameDirectory, stripQuotes } from "../lib/paths.ts";

export default function projectSwitcherExtension(pi: ExtensionAPI) {
  let activeCwd = process.cwd();

  pi.on("session_start", async (_event, ctx) => {
    activeCwd = ctx.cwd;
  });

  pi.registerCommand("pwd", {
    description: "Aktuelles Pi-Arbeitsverzeichnis anzeigen",
    handler: async (_args, ctx) => {
      ctx.ui.notify(ctx.cwd, "info");
    },
  });

  pi.registerCommand("cd", {
    description: "In einen anderen Projektordner wechseln und die Unterhaltung mitnehmen",
    getArgumentCompletions: (prefix) => {
      const normalizedPrefix = prefix.trim().toLocaleLowerCase("de");
      const matches = projectChoices(activeCwd).filter((candidate) =>
        candidate.toLocaleLowerCase("de").startsWith(normalizedPrefix),
      );
      return matches.length > 0
        ? matches.map((candidate) => ({ value: `"${candidate}"`, label: candidate }))
        : null;
    },
    handler: async (args, ctx) => {
      let requested = stripQuotes(args);

      if (!requested) {
        if (!ctx.hasUI) {
          ctx.ui.notify("Verwendung: /cd <Ordner>", "warning");
          return;
        }
        const choices = projectChoices(ctx.cwd);
        if (choices.length === 0) {
          ctx.ui.notify("Keine Projektordner gefunden. Verwendung: /cd <Ordner>", "warning");
          return;
        }
        const selected = await ctx.ui.select("Projektordner auswählen", choices);
        if (!selected) return;
        requested = selected;
      }

      const target = resolveDirectory(requested, ctx.cwd);
      if (!existsSync(target)) {
        ctx.ui.notify(`Ordner nicht gefunden: ${target}`, "error");
        return;
      }
      if (!statSync(target).isDirectory()) {
        ctx.ui.notify(`Kein Ordner: ${target}`, "error");
        return;
      }
      if (sameDirectory(ctx.cwd, target)) {
        ctx.ui.notify(`Bereits im Ordner: ${target}`, "info");
        return;
      }

      const sourceSession = ctx.sessionManager.getSessionFile();
      if (!sourceSession) {
        ctx.ui.notify(
          "Die aktuelle Sitzung wurde noch nicht gespeichert. Sende zuerst eine normale Nachricht und versuche /cd erneut.",
          "warning",
        );
        return;
      }

      let targetSession: string | undefined;
      try {
        const forked = SessionManager.forkFrom(sourceSession, target);
        targetSession = forked.getSessionFile();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Projektwechsel fehlgeschlagen: ${message}`, "error");
        return;
      }

      if (!targetSession) {
        ctx.ui.notify("Für den Zielordner konnte keine Sitzung angelegt werden.", "error");
        return;
      }

      const result = await ctx.switchSession(targetSession, {
        withSession: async (replacementCtx) => {
          replacementCtx.ui.notify(`Arbeitsverzeichnis gewechselt zu: ${replacementCtx.cwd}`, "info");
        },
      });

      if (result.cancelled) {
        ctx.ui.notify("Projektwechsel abgebrochen.", "info");
      }
    },
  });
}
